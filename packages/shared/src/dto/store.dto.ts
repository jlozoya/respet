import type { OrderState } from '../enums.js';
import type { LocationInput } from './user.dto.js';

export interface CreateWarehouseRequest {
  name: string;
  description?: string | null;
  location?: LocationInput | null;
}

export type UpdateWarehouseRequest = Partial<CreateWarehouseRequest>;

export interface CreateProductRequest {
  name: string;
  description: string;
  stock: number;
  price: number;
  warehouseId?: string | null;
}

export type UpdateProductRequest = Partial<CreateProductRequest>;

export interface ProductListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  warehouseId?: string;
}

export interface CreateOrderRequest {
  destination?: LocationInput | null;
}

export interface UpdateOrderRequest {
  destination?: LocationInput | null;
  takeOutDate?: string | null;
  deliveryDate?: string | null;
}

export interface UpdateOrderStateRequest {
  state: OrderState;
  roundsmanId?: string | null;
}

export interface AddOrderItemRequest {
  productId: string;
  quantity: number;
}

export interface UpdateOrderItemRequest {
  quantity: number;
}

export interface OrderListQuery {
  page?: number;
  perPage?: number;
  search?: string;
  state?: OrderState;
  roundsmanId?: string;
}

/** Respuesta al iniciar un cobro: la app redirige a `approvalUrl`. */
export interface CheckoutSession {
  paymentId: string;
  provider: 'paypal';
  externalId: string;
  approvalUrl: string;
}
