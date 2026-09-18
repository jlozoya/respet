import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Order as OrderDto, Paginated } from '@social-network/shared';
import { isValidObjectId } from '../../database/mongoose.js';
import type { ClientSession, Connection, Model } from '../../database/mongoose.js';

import type { AuthenticatedUser } from '../../common/decorators/index.js';
import { AppException, ErrorCode } from '../../common/errors.js';
import { POPULATE_ORDER, toOrder } from '../../common/mappers.js';
import { upsertLocation } from '../../common/utils/location.js';
import { paginate, toPage } from '../../common/utils/pagination.js';
import { escapeRegex } from '../../common/utils/regex.js';
import { Location } from '../../database/schemas/content.schema.js';
import { OrderState } from '../../database/schemas/enums.js';
import { Order, OrderItem, Product } from '../../database/schemas/store.schema.js';
import { User } from '../../database/schemas/user.schema.js';
import type {
  AddOrderItemDto,
  CreateOrderDto,
  OrderListQueryDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  UpdateOrderStateDto,
} from './dto/order.dto.js';

/**
 * Transiciones válidas del estado de un pedido.
 *
 * Tenerlas escritas evita saltos que dejarían el inventario descuadrado, como
 * pasar de `delivered` de vuelta a `on_create`.
 */
const ALLOWED_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  [OrderState.OnCreate]: [OrderState.Stored, OrderState.Cancelled],
  [OrderState.Stored]: [OrderState.OnTransit, OrderState.Cancelled],
  [OrderState.OnTransit]: [OrderState.Delivered, OrderState.Cancelled],
  [OrderState.Delivered]: [],
  [OrderState.Cancelled]: [],
};

/** Filtro de búsqueda, tal y como lo entiende `find`. */
type Filtro = Record<string, unknown>;

@Injectable()
export class OrdersService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(OrderItem.name) private readonly items: Model<OrderItem>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Location.name) private readonly locations: Model<Location>,
  ) {}

  /**
   * Devuelve el carrito abierto del usuario, creándolo si no existe.
   *
   * Un pedido en `on_create` es justo eso: el carrito. Sólo puede haber uno
   * por usuario a la vez.
   */
  async getCurrent(userId: string): Promise<OrderDto> {
    const existente = await this.orders
      .findOne({ userId, state: OrderState.OnCreate })
      .sort({ createdAt: -1 })
      .lean();

    if (existente) {
      return this.findOrFail(String(existente._id));
    }

    const creado = await this.orders.create({ userId, state: OrderState.OnCreate });

    return this.findOrFail(String(creado._id));
  }

  async list(query: OrderListQueryDto): Promise<Paginated<OrderDto>> {
    const { skip, take, page, perPage } = toPage(query);
    const filtros: Filtro[] = [];

    if (query.state) {
      filtros.push({ state: query.state });
    }

    if (query.roundsmanId) {
      filtros.push({ roundsmanId: query.roundsmanId });
    }

    if (query.search?.trim()) {
      // Sin uniones, la búsqueda por cliente se hace en dos pasos: primero
      // quiénes coinciden, luego sus pedidos.
      const search = escapeRegex(query.search.trim());
      const clientes = await this.users
        .find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        })
        .select('_id')
        .lean();

      filtros.push({ userId: { $in: clientes.map((cliente) => cliente._id) } });
    }

    const where: Filtro = filtros.length > 0 ? { $and: filtros } : {};

    return this.paginated(where, skip, take, page, perPage);
  }

  async listMine(userId: string, query: OrderListQueryDto): Promise<Paginated<OrderDto>> {
    const { skip, take, page, perPage } = toPage(query);
    const where: Filtro = { userId, ...(query.state ? { state: query.state } : {}) };

    return this.paginated(where, skip, take, page, perPage);
  }

  async findById(id: string, actor: AuthenticatedUser): Promise<OrderDto> {
    const order = await this.findDocOrFail(id);

    if (String(order.userId) !== actor.id && !isStaff(actor)) {
      throw AppException.forbidden('You can only read your own orders');
    }

    return this.findOrFail(id);
  }

  async create(userId: string, dto: CreateOrderDto): Promise<OrderDto> {
    const destinationId = await upsertLocation(this.locations, null, dto.destination);

    const creado = await this.orders.create({
      userId,
      state: OrderState.OnCreate,
      destinationId: destinationId ?? null,
    });

    return this.findOrFail(String(creado._id));
  }

  async update(id: string, dto: UpdateOrderDto, actor: AuthenticatedUser): Promise<OrderDto> {
    const order = await this.assertCanEdit(id, actor);
    const destinationId = await upsertLocation(
      this.locations,
      order.destinationId,
      dto.destination,
    );

    await this.orders.updateOne(
      { _id: id },
      {
        $set: {
          ...(destinationId !== undefined ? { destinationId } : {}),
          ...(dto.takeOutDate !== undefined
            ? { takeOutDate: dto.takeOutDate ? new Date(dto.takeOutDate) : null }
            : {}),
          ...(dto.deliveryDate !== undefined
            ? { deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null }
            : {}),
        },
      },
    );

    return this.findOrFail(id);
  }

  /**
   * Avanza el estado de un pedido.
   *
   * Al salir de `on_create` se descuenta el inventario, y al cancelar un pedido
   * ya descontado se devuelve. Todo va dentro de una transacción para que no
   * pueda quedarse a medias: es la razón por la que la base corre en «replica
   * set», porque Mongo sólo ofrece transacciones así.
   */
  async updateState(id: string, dto: UpdateOrderStateDto): Promise<OrderDto> {
    await this.assertExists(id);

    await this.inTransaction(async (session) => {
      const order = await this.orders.findById(id).select('state').session(session).lean();

      if (!order) {
        throw AppException.notFound('Order');
      }

      if (order.state === dto.state) {
        return;
      }

      if (!ALLOWED_TRANSITIONS[order.state].includes(dto.state)) {
        throw AppException.conflict(
          ErrorCode.Conflict,
          `An order cannot move from "${order.state}" to "${dto.state}"`,
        );
      }

      const lineas = await this.items
        .find({ orderId: id })
        .select('productId quantity')
        .session(session)
        .lean();

      if (order.state === OrderState.OnCreate && dto.state === OrderState.Stored) {
        await this.reserveStock(session, lineas);
      }

      if (order.state !== OrderState.OnCreate && dto.state === OrderState.Cancelled) {
        await this.releaseStock(session, lineas);
      }

      await this.orders.updateOne(
        { _id: id },
        {
          $set: {
            state: dto.state,
            ...(dto.roundsmanId !== undefined ? { roundsmanId: dto.roundsmanId } : {}),
            ...(dto.state === OrderState.OnTransit ? { takeOutDate: new Date() } : {}),
            ...(dto.state === OrderState.Delivered ? { deliveryDate: new Date() } : {}),
          },
        },
        { session },
      );
    });

    return this.findOrFail(id);
  }

  async addItem(id: string, dto: AddOrderItemDto, actor: AuthenticatedUser): Promise<OrderDto> {
    await this.assertCanEdit(id, actor);

    await this.inTransaction(async (session) => {
      const product = await this.products
        .findById(dto.productId)
        .select('price stock')
        .session(session)
        .lean();

      if (!product) {
        throw AppException.notFound('Product');
      }

      const existente = await this.items
        .findOne({ orderId: id, productId: dto.productId })
        .select('quantity')
        .session(session)
        .lean();

      const quantity = (existente?.quantity ?? 0) + dto.quantity;

      if (quantity > product.stock) {
        throw new AppException(
          ErrorCode.OutOfStock,
          409,
          `Only ${product.stock} units of product ${String(product._id)} are available`,
        );
      }

      await this.items.updateOne(
        { orderId: id, productId: dto.productId },
        {
          $set: { quantity },
          // El precio se congela al añadirlo: si mañana sube el del catálogo,
          // este pedido conserva el que se le mostró al cliente.
          $setOnInsert: { orderId: id, productId: dto.productId, unitPrice: product.price },
        },
        { upsert: true, session },
      );

      await this.recalculateTotal(session, id);
    });

    return this.findOrFail(id);
  }

  async updateItem(
    id: string,
    itemId: string,
    dto: UpdateOrderItemDto,
    actor: AuthenticatedUser,
  ): Promise<OrderDto> {
    await this.assertCanEdit(id, actor);

    await this.inTransaction(async (session) => {
      const item = await this.items
        .findOne({ _id: itemId, orderId: id })
        .select('productId')
        .session(session)
        .lean();

      if (!item) {
        throw AppException.notFound('Order item');
      }

      const product = await this.products
        .findById(item.productId)
        .select('stock')
        .session(session)
        .lean();

      if (product && dto.quantity > product.stock) {
        throw new AppException(
          ErrorCode.OutOfStock,
          409,
          `Only ${product.stock} units of product ${String(item.productId)} are available`,
        );
      }

      if (dto.quantity === 0) {
        await this.items.deleteOne({ _id: itemId }, { session });
      } else {
        await this.items.updateOne(
          { _id: itemId },
          { $set: { quantity: dto.quantity } },
          { session },
        );
      }

      await this.recalculateTotal(session, id);
    });

    return this.findOrFail(id);
  }

  async removeItem(id: string, itemId: string, actor: AuthenticatedUser): Promise<OrderDto> {
    await this.assertCanEdit(id, actor);

    await this.inTransaction(async (session) => {
      const { deletedCount } = await this.items.deleteOne(
        { _id: itemId, orderId: id },
        { session },
      );

      if (deletedCount === 0) {
        throw AppException.notFound('Order item');
      }

      await this.recalculateTotal(session, id);
    });

    return this.findOrFail(id);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const order = await this.assertCanEdit(id, actor);

    if (order.state !== OrderState.OnCreate) {
      throw AppException.conflict(
        ErrorCode.Conflict,
        'Only orders that have not been confirmed yet can be deleted; cancel it instead',
      );
    }

    // Las líneas se van con el pedido: antes lo hacía la clave foránea.
    await this.items.deleteMany({ orderId: id });
    await this.orders.deleteOne({ _id: id });
  }

  /**
   * Recalcula el total desde las líneas.
   *
   * Nunca se acepta un total enviado por el cliente: es el servidor quien lo
   * suma a partir de los precios que él mismo congeló. Va en céntimos, así que
   * la suma es de enteros y no arrastra decimales.
   */
  private async recalculateTotal(session: ClientSession, orderId: string): Promise<void> {
    const lineas = await this.items
      .find({ orderId })
      .select('quantity unitPrice')
      .session(session)
      .lean();

    const total = lineas.reduce((suma, linea) => suma + linea.unitPrice * linea.quantity, 0);

    await this.orders.updateOne({ _id: orderId }, { $set: { total } }, { session });
  }

  private async reserveStock(
    session: ClientSession,
    lineas: { productId: unknown; quantity: number }[],
  ): Promise<void> {
    for (const linea of lineas) {
      // La condición de existencias va en el filtro, así que comprobar y
      // descontar ocurren en la misma operación: dos pedidos simultáneos no
      // pueden llevarse la misma última unidad.
      const { modifiedCount } = await this.products.updateOne(
        { _id: linea.productId, stock: { $gte: linea.quantity } },
        { $inc: { stock: -linea.quantity } },
        { session },
      );

      if (modifiedCount === 0) {
        throw new AppException(
          ErrorCode.OutOfStock,
          409,
          `Product ${String(linea.productId)} no longer has ${linea.quantity} units available`,
        );
      }
    }
  }

  private async releaseStock(
    session: ClientSession,
    lineas: { productId: unknown; quantity: number }[],
  ): Promise<void> {
    for (const linea of lineas) {
      await this.products.updateOne(
        { _id: linea.productId },
        { $inc: { stock: linea.quantity } },
        { session },
      );
    }
  }

  /**
   * Ejecuta el trabajo dentro de una transacción.
   *
   * `withTransaction` se encarga de reintentar si Mongo devuelve un conflicto
   * transitorio, y de cerrar la sesión pase lo que pase.
   */
  private async inTransaction(trabajo: (session: ClientSession) => Promise<void>): Promise<void> {
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        await trabajo(session);
      });
    } finally {
      await session.endSession();
    }
  }

  private async paginated(
    where: Filtro,
    skip: number,
    take: number,
    page: number,
    perPage: number,
  ): Promise<Paginated<OrderDto>> {
    const [docs, total] = await Promise.all([
      this.orders
        .find(where)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate(POPULATE_ORDER)
        .lean(),
      this.orders.countDocuments(where),
    ]);

    return paginate(
      docs.map((doc) => toOrder(doc as never)),
      total,
      page,
      perPage,
    );
  }

  private async findOrFail(id: string): Promise<OrderDto> {
    const doc = await this.orders.findById(id).populate(POPULATE_ORDER).lean();

    if (!doc) {
      throw AppException.notFound('Order');
    }

    return toOrder(doc as never);
  }

  private async findDocOrFail(id: string): Promise<Order & { _id: unknown }> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Order');
    }

    const doc = await this.orders.findById(id).lean();

    if (!doc) {
      throw AppException.notFound('Order');
    }

    return doc;
  }

  private async assertExists(id: string): Promise<void> {
    if (!isValidObjectId(id) || !(await this.orders.exists({ _id: id }))) {
      throw AppException.notFound('Order');
    }
  }

  private async assertCanEdit(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ destinationId: string | null; state: OrderState }> {
    const order = await this.findDocOrFail(id);

    if (String(order.userId) !== actor.id && !isStaff(actor)) {
      throw AppException.forbidden('You can only modify your own orders');
    }

    return {
      destinationId: order.destinationId ? String(order.destinationId) : null,
      state: order.state,
    };
  }
}

/** Roles del personal, que pueden ver y gestionar pedidos ajenos. */
const STAFF_ROLES: readonly AuthenticatedUser['role'][] = ['roundsman', 'supervisor', 'admin'];

function isStaff(actor: AuthenticatedUser): boolean {
  return STAFF_ROLES.includes(actor.role);
}
