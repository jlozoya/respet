import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes } from '../../database/mongoose.js';
import type { HydratedDocument, Types } from '../../database/mongoose.js';

import { OrderState, PaymentProvider, PaymentStatus } from './enums.js';

/**
 * Tienda: bodegas, catálogo, pedidos y cobros.
 *
 * Los importes se guardan en céntimos enteros. En SQL eran `DECIMAL(10,2)`, un
 * tipo que Mongo no tiene; con `Double` se perderían céntimos en cuanto hubiera
 * que sumar, así que se guarda la cantidad exacta y se divide sólo al mostrar.
 */
@Schema({ collection: 'warehouses', timestamps: true })
export class Warehouse {
  @Prop({ required: true, index: true })
  name!: string;

  @Prop({ type: String, default: null })
  description!: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Location', default: null })
  locationId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Media', default: null })
  mediaId!: Types.ObjectId | null;
}

export type WarehouseDocument = HydratedDocument<Warehouse>;
export const WarehouseSchema = SchemaFactory.createForClass(Warehouse);

WarehouseSchema.virtual('location', {
  ref: 'Location',
  localField: 'locationId',
  foreignField: '_id',
  justOne: true,
});

WarehouseSchema.virtual('media', {
  ref: 'Media',
  localField: 'mediaId',
  foreignField: '_id',
  justOne: true,
});

WarehouseSchema.set('toObject', { virtuals: true });
WarehouseSchema.set('toJSON', { virtuals: true });

@Schema({ collection: 'products', timestamps: true })
export class Product {
  @Prop({ required: true, index: true })
  name!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ default: 0 })
  stock!: number;

  /** En céntimos. */
  @Prop({ required: true })
  price!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Warehouse', default: null, index: true })
  warehouseId!: Types.ObjectId | null;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.virtual('warehouse', {
  ref: 'Warehouse',
  localField: 'warehouseId',
  foreignField: '_id',
  justOne: true,
});

ProductSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'productId',
  options: { sort: { position: 1 } },
});

ProductSchema.set('toObject', { virtuals: true });
ProductSchema.set('toJSON', { virtuals: true });

@Schema({ collection: 'orders', timestamps: true })
export class Order {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', default: null, index: true })
  roundsmanId!: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(OrderState), default: OrderState.OnCreate })
  state!: OrderState;

  /** En céntimos. */
  @Prop({ default: 0 })
  total!: number;

  @Prop({ type: Date, default: null })
  takeOutDate!: Date | null;

  @Prop({ type: Date, default: null })
  deliveryDate!: Date | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Location', default: null })
  originId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Location', default: null })
  destinationId!: Types.ObjectId | null;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.virtual('customer', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

OrderSchema.virtual('roundsman', {
  ref: 'User',
  localField: 'roundsmanId',
  foreignField: '_id',
  justOne: true,
});

OrderSchema.virtual('origin', {
  ref: 'Location',
  localField: 'originId',
  foreignField: '_id',
  justOne: true,
});

OrderSchema.virtual('destination', {
  ref: 'Location',
  localField: 'destinationId',
  foreignField: '_id',
  justOne: true,
});

OrderSchema.virtual('items', {
  ref: 'OrderItem',
  localField: '_id',
  foreignField: 'orderId',
});

OrderSchema.set('toObject', { virtuals: true });
OrderSchema.set('toJSON', { virtuals: true });

OrderSchema.index({ userId: 1, state: 1 });
OrderSchema.index({ state: 1, createdAt: -1 });

@Schema({ collection: 'order_items', timestamps: true })
export class OrderItem {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Product', required: true, index: true })
  productId!: Types.ObjectId;

  @Prop({ default: 1 })
  quantity!: number;

  /** En céntimos, congelado en el momento de la compra. */
  @Prop({ required: true })
  unitPrice!: number;
}

export type OrderItemDocument = HydratedDocument<OrderItem>;
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

OrderItemSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true,
});

OrderItemSchema.set('toObject', { virtuals: true });
OrderItemSchema.set('toJSON', { virtuals: true });

/** Un producto aparece una sola vez por pedido; repetirlo sube la cantidad. */
OrderItemSchema.index({ orderId: 1, productId: 1 }, { unique: true });

@Schema({ collection: 'payments', timestamps: true })
export class Payment {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order', required: true, index: true })
  orderId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(PaymentProvider), default: PaymentProvider.PayPal })
  provider!: PaymentProvider;

  @Prop({ type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.Pending, index: true })
  status!: PaymentStatus;

  /** En céntimos. */
  @Prop({ required: true })
  amount!: number;

  @Prop({ default: 'MXN' })
  currency!: string;

  @Prop({ type: String, default: null })
  externalId!: string | null;

  /** Respuesta cruda de la pasarela, tal y como llegó. */
  @Prop({ type: SchemaTypes.Mixed, default: null })
  payload!: unknown;
}

export type PaymentDocument = HydratedDocument<Payment>;
export const PaymentSchema = SchemaFactory.createForClass(Payment);

/**
 * El identificador externo es único por pasarela, pero sólo cuando existe: un
 * índice único normal consideraría iguales todos los cobros sin identificador.
 */
PaymentSchema.index(
  { provider: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } },
);
