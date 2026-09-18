import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Branding, CheckoutSession, Payment } from '@social-network/shared';

import type { AuthenticatedUser } from '../../common/decorators/index.js';
import { AppException, ErrorCode } from '../../common/errors.js';
import { fromCents, toPayment } from '../../common/mappers.js';
import { MailService } from '../../mail/mail.service.js';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId } from '../../database/mongoose.js';
import type { Model } from '../../database/mongoose.js';

import {
  OrderState,
  PaymentProvider,
  PaymentStatus,
} from '../../database/schemas/enums.js';
import { Order, Payment as PaymentDoc } from '../../database/schemas/store.schema.js';
import { User } from '../../database/schemas/user.schema.js';
import { OrdersService } from '../orders/orders.service.js';
import { PayPalClient } from './paypal.client.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(PaymentDoc.name) private readonly payments: Model<PaymentDoc>,
    @InjectModel(Order.name) private readonly ordersModel: Model<Order>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly paypal: PayPalClient,
    private readonly orders: OrdersService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Abre un cobro para un pedido.
   *
   * El importe se toma del total que el servidor calculó, nunca de la petición.
   */
  async checkout(orderId: string, actor: AuthenticatedUser): Promise<CheckoutSession> {
    if (!isValidObjectId(orderId)) {
      throw AppException.notFound('Order');
    }

    const order = await this.ordersModel.findById(orderId).select('userId state total').lean();

    if (!order) {
      throw AppException.notFound('Order');
    }

    if (String(order.userId) !== actor.id) {
      throw AppException.forbidden('You can only pay for your own orders');
    }

    if (order.state !== OrderState.OnCreate) {
      throw AppException.conflict(ErrorCode.Conflict, 'This order has already been confirmed');
    }

    const lineas = await this.ordersModel.db
      .collection('order_items')
      .countDocuments({ orderId: order._id });

    if (lineas === 0) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'The order has no items');
    }

    if (order.total <= 0) {
      throw AppException.badRequest(ErrorCode.ValidationFailed, 'The order total must be positive');
    }

    const currency = this.paypal.currency;
    const clientUrl = this.config.getOrThrow<string>('clientUrl');

    // Hacia PayPal el importe va en unidades; dentro se guarda en céntimos.
    const paypalOrder = await this.paypal.createOrder({
      amount: fromCents(order.total).toFixed(2),
      currency,
      referenceId: orderId,
      description: `${this.config.getOrThrow<Branding>('branding').name} · pedido n.º ${orderId}`,
      returnUrl: `${clientUrl}/orders/${orderId}?payment=success`,
      cancelUrl: `${clientUrl}/orders/${orderId}?payment=cancelled`,
    });

    const approvalUrl = paypalOrder.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new AppException(
        ErrorCode.PaymentFailed,
        502,
        'PayPal did not return an approval link',
      );
    }

    const payment = await this.payments.create({
      orderId,
      provider: PaymentProvider.PayPal,
      status: PaymentStatus.Pending,
      amount: order.total,
      currency,
      externalId: paypalOrder.id,
    });

    return {
      paymentId: String(payment._id),
      provider: 'paypal',
      externalId: paypalOrder.id,
      approvalUrl,
    };
  }

  /** Cobra un pago que el comprador ya aprobó en PayPal. */
  async capture(paymentId: string, actor: AuthenticatedUser): Promise<Payment> {
    if (!isValidObjectId(paymentId)) {
      throw AppException.notFound('Payment');
    }

    const payment = await this.payments.findById(paymentId).lean();

    if (!payment?.externalId) {
      throw AppException.notFound('Payment');
    }

    const order = await this.ordersModel.findById(payment.orderId).select('userId').lean();

    if (!order) {
      throw AppException.notFound('Order');
    }

    if (String(order.userId) !== actor.id) {
      throw AppException.forbidden('You can only capture your own payments');
    }

    if (payment.status === PaymentStatus.Completed) {
      return this.findById(paymentId);
    }

    const capture = await this.paypal.captureOrder(payment.externalId);

    if (capture.status !== 'COMPLETED') {
      await this.payments.updateOne(
        { _id: paymentId },
        { $set: { status: PaymentStatus.Failed, payload: capture } },
      );

      throw new AppException(
        ErrorCode.PaymentFailed,
        402,
        `PayPal returned status "${capture.status}"`,
      );
    }

    await this.settle(paymentId, capture);

    return this.findById(paymentId);
  }

  /**
   * Procesa una notificación de PayPal.
   *
   * Es la red de seguridad para cuando el comprador cierra la app entre que
   * aprueba el pago y vuelve: PayPal avisa igual y el pedido se confirma.
   */
  async handleWebhook(headers: Record<string, string | undefined>, body: unknown): Promise<void> {
    const webhookId = this.config.get<string>('paypal.webhookId');

    if (!webhookId) {
      this.logger.warn('Llega un webhook de PayPal pero PAYPAL_WEBHOOK_ID no está configurado');

      return;
    }

    const verified = await this.paypal.verifyWebhook({ webhookId, headers, body });

    if (!verified) {
      // Se responde 200 igualmente para que PayPal no reintente en bucle, pero
      // no se toca nada: el aviso no es de fiar.
      this.logger.warn('Webhook de PayPal descartado: la firma no es válida');

      return;
    }

    const event = body as { event_type?: string; resource?: { id?: string; supplementary_data?: { related_ids?: { order_id?: string } } } };

    if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      return;
    }

    const externalId = event.resource?.supplementary_data?.related_ids?.order_id;

    if (!externalId) {
      return;
    }

    const payment = await this.payments
      .findOne({ provider: PaymentProvider.PayPal, externalId })
      .select('status')
      .lean();

    if (!payment || payment.status === PaymentStatus.Completed) {
      return;
    }

    await this.settle(String(payment._id), body);
  }

  async findById(id: string): Promise<Payment> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Payment');
    }

    const doc = await this.payments.findById(id).lean();

    if (!doc) {
      throw AppException.notFound('Payment');
    }

    return toPayment(doc as never);
  }

  async listForOrder(orderId: string, actor: AuthenticatedUser): Promise<Payment[]> {
    if (!isValidObjectId(orderId)) {
      throw AppException.notFound('Order');
    }

    const order = await this.ordersModel.findById(orderId).select('userId').lean();

    if (!order) {
      throw AppException.notFound('Order');
    }

    if (String(order.userId) !== actor.id && actor.role !== 'admin') {
      throw AppException.forbidden('You can only read your own payments');
    }

    const docs = await this.payments.find({ orderId }).sort({ createdAt: -1 }).lean();

    return docs.map((doc) => toPayment(doc as never));
  }

  /**
   * Marca el pago como cobrado y confirma el pedido.
   *
   * Se apoya en `OrdersService.updateState` en lugar de tocar el pedido a mano,
   * para que el descuento de inventario siga una sola ruta.
   */
  private async settle(paymentId: string, payload: unknown): Promise<void> {
    await this.payments.updateOne(
      { _id: paymentId },
      { $set: { status: PaymentStatus.Completed, payload } },
    );

    const payment = await this.payments.findById(paymentId).lean();

    if (!payment) {
      return;
    }

    const order = await this.ordersModel.findById(payment.orderId).select('state userId').lean();

    if (!order) {
      return;
    }

    const orderId = String(order._id);

    if (order.state === OrderState.OnCreate) {
      await this.orders.updateState(orderId, { state: OrderState.Stored });
    }

    const cliente = await this.users.findById(order.userId).select('email name lang').lean();

    if (!cliente) {
      return;
    }

    void this.mail.sendPaymentConfirmation(cliente.email, {
      name: cliente.name,
      orderId,
      total: `${fromCents(payment.amount).toFixed(2)} ${payment.currency}`,
      lang: cliente.lang,
    });
  }
}
