import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  AddOrderItemRequest,
  CheckoutSession,
  CreateOrderRequest,
  CreateProductRequest,
  CreateWarehouseRequest,
  Media,
  Order,
  OrderListQuery,
  OrderState,
  Paginated,
  Payment,
  Product,
  ProductListQuery,
  UpdateOrderRequest,
  UpdateProductRequest,
  UpdateWarehouseRequest,
  Warehouse,
} from '@respet/shared';

import {
  MEDIA_FRAGMENTS,
  ORDER_FRAGMENTS,
  PAGE_META_FRAGMENTS,
  PAYMENT_FRAGMENTS,
  PRODUCT_FRAGMENTS,
  WAREHOUSE_FRAGMENTS,
  gql,
} from './fragments';
import { GraphqlClientService } from './graphql-client.service';

const WAREHOUSES = gql(
  `query Warehouses($query: WarehouseListQueryInput) {
    warehouses(query: $query) {
      data { ...WarehouseFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...WAREHOUSE_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const WAREHOUSE = gql(
  `query WarehouseById($id: ID!) {
    warehouse(id: $id) { ...WarehouseFields }
  }`,
  ...WAREHOUSE_FRAGMENTS,
);

const CREATE_WAREHOUSE = gql(
  `mutation CreateWarehouse($input: CreateWarehouseInput!) {
    createWarehouse(input: $input) { ...WarehouseFields }
  }`,
  ...WAREHOUSE_FRAGMENTS,
);

const UPDATE_WAREHOUSE = gql(
  `mutation UpdateWarehouse($id: ID!, $input: UpdateWarehouseInput!) {
    updateWarehouse(id: $id, input: $input) { ...WarehouseFields }
  }`,
  ...WAREHOUSE_FRAGMENTS,
);

const DELETE_WAREHOUSE = `mutation DeleteWarehouse($id: ID!) { deleteWarehouse(id: $id) }`;

const SET_WAREHOUSE_IMAGE = gql(
  `mutation SetWarehouseImage($id: ID!, $file: Upload!) {
    setWarehouseImage(id: $id, file: $file) { ...WarehouseFields }
  }`,
  ...WAREHOUSE_FRAGMENTS,
);

@Injectable({ providedIn: 'root' })
export class WarehousesService {
  private readonly gql = inject(GraphqlClientService);

  async list(
    query: { page?: number; perPage?: number; search?: string } = {},
  ): Promise<Paginated<Warehouse>> {
    const { warehouses } = await this.gql.request<{ warehouses: Paginated<Warehouse> }>(
      WAREHOUSES,
      { query },
    );

    return warehouses;
  }

  async findById(id: string): Promise<Warehouse> {
    const { warehouse } = await this.gql.request<{ warehouse: Warehouse }>(WAREHOUSE, { id });

    return warehouse;
  }

  async create(request: CreateWarehouseRequest): Promise<Warehouse> {
    const { createWarehouse } = await this.gql.request<{ createWarehouse: Warehouse }>(
      CREATE_WAREHOUSE,
      { input: request },
    );

    return createWarehouse;
  }

  async update(id: string, request: UpdateWarehouseRequest): Promise<Warehouse> {
    const { updateWarehouse } = await this.gql.request<{ updateWarehouse: Warehouse }>(
      UPDATE_WAREHOUSE,
      { id, input: request },
    );

    return updateWarehouse;
  }

  async setImage(id: string, file: Blob): Promise<Warehouse> {
    const { setWarehouseImage } = await this.gql.request<{ setWarehouseImage: Warehouse }>(
      SET_WAREHOUSE_IMAGE,
      { id, file },
    );

    return setWarehouseImage;
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_WAREHOUSE, { id });
  }
}

const PRODUCTS = gql(
  `query Products($query: ProductListQueryInput) {
    products(query: $query) {
      data { ...ProductFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...PRODUCT_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const PRODUCT = gql(
  `query ProductById($id: ID!) {
    product(id: $id) { ...ProductFields }
  }`,
  ...PRODUCT_FRAGMENTS,
);

const CREATE_PRODUCT = gql(
  `mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) { ...ProductFields }
  }`,
  ...PRODUCT_FRAGMENTS,
);

const UPDATE_PRODUCT = gql(
  `mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
    updateProduct(id: $id, input: $input) { ...ProductFields }
  }`,
  ...PRODUCT_FRAGMENTS,
);

const ADD_PRODUCT_MEDIA = gql(
  `mutation AddProductMedia($id: ID!, $file: Upload!) {
    addProductMedia(id: $id, file: $file) { ...MediaFields }
  }`,
  ...MEDIA_FRAGMENTS,
);

const REMOVE_PRODUCT_MEDIA = `
mutation RemoveProductMedia($id: ID!, $mediaId: ID!) {
  removeProductMedia(id: $id, mediaId: $mediaId)
}`;

const DELETE_PRODUCT = `mutation DeleteProduct($id: ID!) { deleteProduct(id: $id) }`;

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly gql = inject(GraphqlClientService);

  async list(query: ProductListQuery = {}): Promise<Paginated<Product>> {
    const { products } = await this.gql.request<{ products: Paginated<Product> }>(PRODUCTS, {
      query,
    });

    return products;
  }

  async findById(id: string): Promise<Product> {
    const { product } = await this.gql.request<{ product: Product }>(PRODUCT, { id });

    return product;
  }

  async create(request: CreateProductRequest): Promise<Product> {
    const { createProduct } = await this.gql.request<{ createProduct: Product }>(CREATE_PRODUCT, {
      input: request,
    });

    return createProduct;
  }

  async update(id: string, request: UpdateProductRequest): Promise<Product> {
    const { updateProduct } = await this.gql.request<{ updateProduct: Product }>(UPDATE_PRODUCT, {
      id,
      input: request,
    });

    return updateProduct;
  }

  async addImage(id: string, file: Blob): Promise<Media> {
    const { addProductMedia } = await this.gql.request<{ addProductMedia: Media }>(ADD_PRODUCT_MEDIA, {
      id,
      file,
    });

    return addProductMedia;
  }

  async removeImage(id: string, mediaId: string): Promise<void> {
    await this.gql.request(REMOVE_PRODUCT_MEDIA, { id, mediaId });
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_PRODUCT, { id });
  }
}

const CURRENT_ORDER = gql(
  `query CurrentOrder { currentOrder { ...OrderFields } }`,
  ...ORDER_FRAGMENTS,
);

const MY_ORDERS = gql(
  `query MyOrders($query: OrderListQueryInput) {
    myOrders(query: $query) {
      data { ...OrderFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...ORDER_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const ORDERS = gql(
  `query Orders($query: OrderListQueryInput) {
    orders(query: $query) {
      data { ...OrderFields }
      meta { ...PageMetaFields }
    }
  }`,
  ...ORDER_FRAGMENTS,
  ...PAGE_META_FRAGMENTS,
);

const ORDER = gql(
  `query OrderById($id: ID!) {
    order(id: $id) { ...OrderFields }
  }`,
  ...ORDER_FRAGMENTS,
);

const CREATE_ORDER = gql(
  `mutation CreateOrder($input: CreateOrderInput) {
    createOrder(input: $input) { ...OrderFields }
  }`,
  ...ORDER_FRAGMENTS,
);

const UPDATE_ORDER = gql(
  `mutation UpdateOrder($id: ID!, $input: UpdateOrderInput!) {
    updateOrder(id: $id, input: $input) { ...OrderFields }
  }`,
  ...ORDER_FRAGMENTS,
);

const UPDATE_ORDER_STATE = gql(
  `mutation UpdateOrderState($id: ID!, $input: UpdateOrderStateInput!) {
    updateOrderState(id: $id, input: $input) { ...OrderFields }
  }`,
  ...ORDER_FRAGMENTS,
);

const ADD_ORDER_ITEM = gql(
  `mutation AddOrderItem($id: ID!, $input: AddOrderItemInput!) {
    addOrderItem(id: $id, input: $input) { ...OrderFields }
  }`,
  ...ORDER_FRAGMENTS,
);

const UPDATE_ORDER_ITEM = gql(
  `mutation UpdateOrderItem($id: ID!, $itemId: ID!, $input: UpdateOrderItemInput!) {
    updateOrderItem(id: $id, itemId: $itemId, input: $input) { ...OrderFields }
  }`,
  ...ORDER_FRAGMENTS,
);

const REMOVE_ORDER_ITEM = gql(
  `mutation RemoveOrderItem($id: ID!, $itemId: ID!) {
    removeOrderItem(id: $id, itemId: $itemId) { ...OrderFields }
  }`,
  ...ORDER_FRAGMENTS,
);

const DELETE_ORDER = `mutation DeleteOrder($id: ID!) { deleteOrder(id: $id) }`;

const CHECKOUT = `
mutation Checkout($orderId: ID!) {
  checkout(orderId: $orderId) { paymentId provider externalId approvalUrl }
}`;

const CAPTURE_PAYMENT = gql(
  `mutation CapturePayment($id: ID!) {
    capturePayment(id: $id) { ...PaymentFields }
  }`,
  ...PAYMENT_FRAGMENTS,
);

const ORDER_PAYMENTS = gql(
  `query OrderPayments($orderId: ID!) {
    orderPayments(orderId: $orderId) { ...PaymentFields }
  }`,
  ...PAYMENT_FRAGMENTS,
);

/**
 * Pedidos y carrito.
 *
 * El carrito no es una estructura aparte: es el pedido del usuario que sigue en
 * estado `on_create`. El servidor lo crea a demanda y recalcula el total en
 * cada cambio, de modo que aquí basta con guardar lo último que respondió.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly gql = inject(GraphqlClientService);

  private readonly cartSignal = signal<Order | null>(null);

  readonly cart = this.cartSignal.asReadonly();
  readonly itemCount = computed(() =>
    (this.cartSignal()?.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
  );
  readonly cartTotal = computed(() => this.cartSignal()?.total ?? 0);

  /** Carga el carrito abierto, creándolo en el servidor si no existía. */
  async loadCart(): Promise<Order> {
    const { currentOrder } = await this.gql.request<{ currentOrder: Order }>(CURRENT_ORDER);
    this.cartSignal.set(currentOrder);

    return currentOrder;
  }

  /** Vacía la copia local del carrito, por ejemplo al cerrar sesión. */
  clearCart(): void {
    this.cartSignal.set(null);
  }

  async addItem(request: AddOrderItemRequest): Promise<Order> {
    const cart = this.cartSignal() ?? (await this.loadCart());
    const { addOrderItem } = await this.gql.request<{ addOrderItem: Order }>(ADD_ORDER_ITEM, {
      id: cart.id,
      input: request,
    });
    this.cartSignal.set(addOrderItem);

    return addOrderItem;
  }

  async updateItemQuantity(itemId: string, quantity: number): Promise<Order> {
    const cart = this.requireCart();
    const { updateOrderItem } = await this.gql.request<{ updateOrderItem: Order }>(
      UPDATE_ORDER_ITEM,
      { id: cart.id, itemId, input: { quantity } },
    );
    this.cartSignal.set(updateOrderItem);

    return updateOrderItem;
  }

  async removeItem(itemId: string): Promise<Order> {
    const cart = this.requireCart();
    const { removeOrderItem } = await this.gql.request<{ removeOrderItem: Order }>(
      REMOVE_ORDER_ITEM,
      { id: cart.id, itemId },
    );
    this.cartSignal.set(removeOrderItem);

    return removeOrderItem;
  }

  async listMine(query: OrderListQuery = {}): Promise<Paginated<Order>> {
    const { myOrders } = await this.gql.request<{ myOrders: Paginated<Order> }>(MY_ORDERS, {
      query,
    });

    return myOrders;
  }

  async list(query: OrderListQuery = {}): Promise<Paginated<Order>> {
    const { orders } = await this.gql.request<{ orders: Paginated<Order> }>(ORDERS, { query });

    return orders;
  }

  async findById(id: string): Promise<Order> {
    const { order } = await this.gql.request<{ order: Order }>(ORDER, { id });

    return order;
  }

  async create(request: CreateOrderRequest = {}): Promise<Order> {
    const { createOrder } = await this.gql.request<{ createOrder: Order }>(CREATE_ORDER, {
      input: request,
    });

    return createOrder;
  }

  async update(id: string, request: UpdateOrderRequest): Promise<Order> {
    const { updateOrder } = await this.gql.request<{ updateOrder: Order }>(UPDATE_ORDER, {
      id,
      input: request,
    });

    return updateOrder;
  }

  async updateState(id: string, state: OrderState, roundsmanId?: string | null): Promise<Order> {
    const { updateOrderState } = await this.gql.request<{ updateOrderState: Order }>(
      UPDATE_ORDER_STATE,
      { id, input: { state, roundsmanId } },
    );

    return updateOrderState;
  }

  async remove(id: string): Promise<void> {
    await this.gql.request(DELETE_ORDER, { id });
  }

  /** Abre el cobro y devuelve el enlace de PayPal al que llevar al comprador. */
  async checkout(orderId: string): Promise<CheckoutSession> {
    const { checkout } = await this.gql.request<{ checkout: CheckoutSession }>(CHECKOUT, {
      orderId,
    });

    return checkout;
  }

  /** Confirma el cobro cuando PayPal devuelve al comprador a la aplicación. */
  async capturePayment(paymentId: string): Promise<Payment> {
    const { capturePayment } = await this.gql.request<{ capturePayment: Payment }>(
      CAPTURE_PAYMENT,
      { id: paymentId },
    );
    // El pedido pagado deja de ser el carrito abierto.
    this.cartSignal.set(null);

    return capturePayment;
  }

  async payments(orderId: string): Promise<Payment[]> {
    const { orderPayments } = await this.gql.request<{ orderPayments: Payment[] }>(ORDER_PAYMENTS, {
      orderId,
    });

    return orderPayments;
  }

  private requireCart(): Order {
    const cart = this.cartSignal();

    if (!cart) {
      throw new Error('No hay ningún carrito cargado; llama antes a loadCart().');
    }

    return cart;
  }
}
