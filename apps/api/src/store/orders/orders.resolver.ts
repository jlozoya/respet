import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Order, Paginated } from '@social-network/shared';

import { CurrentUser, Roles, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { OrderPage, OrderType } from '../../graphql/types/store.types.js';
import {
  AddOrderItemDto,
  CreateOrderDto,
  OrderListQueryDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  UpdateOrderStateDto,
} from './dto/order.dto.js';
import { OrdersService } from './orders.service.js';

/**
 * Pedidos y carrito.
 *
 * El carrito no es una estructura aparte: es el pedido del usuario que sigue
 * en estado `on_create`. `currentOrder` lo crea a demanda si no había ninguno,
 * y cada cambio en sus líneas devuelve el pedido entero con el total ya
 * recalculado, para que el cliente no tenga que sumar por su cuenta.
 */
@Resolver(() => OrderType)
export class OrdersResolver {
  constructor(private readonly orders: OrdersService) {}

  @Roles('roundsman')
  @Query(() => OrderPage, { name: 'orders', description: 'Todos los pedidos, para el personal.' })
  async list(
    @Args('query', { type: () => OrderListQueryDto, nullable: true })
    query: OrderListQueryDto = {},
  ): Promise<Paginated<Order>> {
    return this.orders.list(query);
  }

  @Query(() => OrderPage, { name: 'myOrders' })
  async listMine(
    @CurrentUser('id') userId: string,
    @Args('query', { type: () => OrderListQueryDto, nullable: true })
    query: OrderListQueryDto = {},
  ): Promise<Paginated<Order>> {
    return this.orders.listMine(userId, query);
  }

  @Query(() => OrderType, {
    name: 'currentOrder',
    description: 'Carrito abierto. Si no había ninguno sin confirmar, se crea uno vacío.',
  })
  async current(@CurrentUser('id') userId: string): Promise<Order> {
    return this.orders.getCurrent(userId);
  }

  @Query(() => OrderType, { name: 'order' })
  async findOne(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Order> {
    return this.orders.findById(id, actor);
  }

  @Mutation(() => OrderType)
  async createOrder(
    @CurrentUser('id') userId: string,
    @Args('input', { type: () => CreateOrderDto, nullable: true })
    input: CreateOrderDto = {},
  ): Promise<Order> {
    return this.orders.create(userId, input);
  }

  @Mutation(() => OrderType, { description: 'Edita el destino o las fechas de un pedido.' })
  async updateOrder(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateOrderDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Order> {
    return this.orders.update(id, input, actor);
  }

  @Roles('roundsman')
  @Mutation(() => OrderType, {
    description: 'Avanza el estado. Confirmarlo descuenta inventario; cancelarlo lo devuelve.',
  })
  async updateOrderState(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateOrderStateDto,
  ): Promise<Order> {
    return this.orders.updateState(id, input);
  }

  @Mutation(() => OrderType)
  async addOrderItem(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: AddOrderItemDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Order> {
    return this.orders.addItem(id, input, actor);
  }

  @Mutation(() => OrderType)
  async updateOrderItem(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('itemId', { type: () => ID }, ParseObjectIdPipe) itemId: string,
    @Args('input') input: UpdateOrderItemDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Order> {
    return this.orders.updateItem(id, itemId, input, actor);
  }

  @Mutation(() => OrderType)
  async removeOrderItem(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('itemId', { type: () => ID }, ParseObjectIdPipe) itemId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Order> {
    return this.orders.removeItem(id, itemId, actor);
  }

  @Mutation(() => Boolean, { description: 'Borra un pedido que aún no se ha confirmado.' })
  async deleteOrder(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<boolean> {
    await this.orders.remove(id, actor);

    return true;
  }
}
