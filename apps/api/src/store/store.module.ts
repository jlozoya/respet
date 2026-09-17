import { Module } from '@nestjs/common';

import { OrdersResolver } from './orders/orders.resolver.js';
import { OrdersService } from './orders/orders.service.js';
import { PaymentsController } from './payments/payments.controller.js';
import { PaymentsResolver } from './payments/payments.resolver.js';
import { PaymentsService } from './payments/payments.service.js';
import { PayPalClient } from './payments/paypal.client.js';
import { ProductsResolver } from './products/products.resolver.js';
import { ProductsService } from './products/products.service.js';
import { WarehousesResolver } from './warehouses/warehouses.resolver.js';
import { WarehousesService } from './warehouses/warehouses.service.js';

/**
 * Tienda: bodegas, catálogo, pedidos y cobros.
 *
 * Van en un mismo módulo porque comparten reglas —inventario, precios y
 * estados de pedido— y separarlos sólo añadiría importaciones cruzadas. De los
 * cuatro dominios sólo quedan dos rutas REST: las fotos de bodegas y productos,
 * y el aviso de PayPal.
 */
@Module({
  controllers: [PaymentsController],
  providers: [
    WarehousesResolver,
    WarehousesService,
    ProductsResolver,
    ProductsService,
    OrdersResolver,
    OrdersService,
    PaymentsResolver,
    PaymentsService,
    PayPalClient,
  ],
  exports: [OrdersService, ProductsService],
})
export class StoreModule {}
