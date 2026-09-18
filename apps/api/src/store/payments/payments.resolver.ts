import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { CheckoutSession, Payment } from '@social-network/shared';

import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/index.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { CheckoutSessionType, PaymentType } from '../../graphql/types/store.types.js';
import { PaymentsService } from './payments.service.js';

@Resolver(() => PaymentType)
export class PaymentsResolver {
  constructor(private readonly payments: PaymentsService) {}

  @Query(() => [PaymentType], { name: 'orderPayments' })
  async listForOrder(
    @Args('orderId', { type: () => ID }, ParseObjectIdPipe) orderId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Payment[]> {
    return this.payments.listForOrder(orderId, actor);
  }

  @Mutation(() => CheckoutSessionType, {
    description: 'Inicia el cobro y devuelve el enlace de PayPal al que ir.',
  })
  async checkout(
    @Args('orderId', { type: () => ID }, ParseObjectIdPipe) orderId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<CheckoutSession> {
    return this.payments.checkout(orderId, actor);
  }

  @Mutation(() => PaymentType, {
    description: 'Cobra un pago ya aprobado, cuando PayPal devuelve al comprador.',
  })
  async capturePayment(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) paymentId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Payment> {
    return this.payments.capture(paymentId, actor);
  }
}
