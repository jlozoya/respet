import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { Public } from '../../common/decorators/index.js';
import { PaymentsService } from './payments.service.js';

/**
 * El aviso que manda PayPal cuando un pago cambia de estado.
 *
 * Lo llama PayPal, no la aplicación: tiene que ser una ruta HTTP corriente con
 * su cuerpo y sus cabeceras, que son las que llevan la firma a verificar.
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post('paypal/webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: unknown,
  ): Promise<void> {
    await this.payments.handleWebhook(headers, body);
  }
}
