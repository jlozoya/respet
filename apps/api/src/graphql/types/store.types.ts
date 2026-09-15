import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import type {
  CheckoutSession,
  Order,
  OrderItem,
  Payment,
  Product,
  Warehouse,
} from '@respet/shared';

import { OrderState, PaymentProvider, PaymentStatus } from '../enums.js';
import { LocationType, MediaType, Paginated } from './common.types.js';
import { UserSummaryType } from './user.types.js';

@ObjectType('Warehouse', { description: 'Bodega desde la que salen los pedidos.' })
export class WarehouseType implements Warehouse {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => LocationType, { nullable: true })
  location!: LocationType | null;

  @Field(() => MediaType, { nullable: true })
  media!: MediaType | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('Product')
export class ProductType implements Product {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field(() => Int, { description: 'Existencias disponibles.' })
  stock!: number;

  @Field(() => Float, { description: 'Precio unitario, en la divisa del servidor.' })
  price!: number;

  @Field(() => WarehouseType, { nullable: true })
  warehouse!: WarehouseType | null;

  @Field(() => [MediaType])
  media!: MediaType[];

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('OrderItem', { description: 'Una línea del pedido.' })
export class OrderItemType implements OrderItem {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => ProductType, { nullable: true })
  product!: ProductType | null;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Float, { description: 'Precio unitario congelado al añadirlo.' })
  unitPrice!: number;

  @Field(() => Float)
  subtotal!: number;
}

@ObjectType('Order')
export class OrderType implements Order {
  @Field(() => ID)
  id!: string;

  @Field(() => OrderState)
  state!: OrderState;

  @Field(() => Float)
  total!: number;

  @Field(() => UserSummaryType)
  customer!: UserSummaryType;

  @Field(() => UserSummaryType, { nullable: true })
  roundsman!: UserSummaryType | null;

  @Field(() => [OrderItemType])
  items!: OrderItemType[];

  @Field(() => LocationType, { nullable: true })
  origin!: LocationType | null;

  @Field(() => LocationType, { nullable: true })
  destination!: LocationType | null;

  @Field(() => String, { nullable: true })
  takeOutDate!: string | null;

  @Field(() => String, { nullable: true })
  deliveryDate!: string | null;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType('Payment')
export class PaymentType implements Payment {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  orderId!: string;

  @Field(() => PaymentProvider)
  provider!: PaymentProvider;

  @Field(() => PaymentStatus)
  status!: PaymentStatus;

  @Field(() => Float)
  amount!: number;

  @Field()
  currency!: string;

  @Field(() => String, { nullable: true, description: 'Id de la transacción en el proveedor.' })
  externalId!: string | null;

  @Field()
  createdAt!: string;
}

@ObjectType('CheckoutSession', { description: 'Cobro recién abierto: la app lleva a `approvalUrl`.' })
export class CheckoutSessionType implements CheckoutSession {
  @Field(() => ID)
  paymentId!: string;

  @Field()
  provider!: 'paypal';

  @Field()
  externalId!: string;

  @Field()
  approvalUrl!: string;
}

export const WarehousePage = Paginated(WarehouseType, 'Warehouse');
export const ProductPage = Paginated(ProductType, 'Product');
export const OrderPage = Paginated(OrderType, 'Order');
