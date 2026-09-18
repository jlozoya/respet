import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException, ErrorCode } from '../../common/errors.js';

const API_BASE = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
} as const;

export interface PayPalOrder {
  id: string;
  status: string;
  links?: { href: string; rel: string; method: string }[];
}

export interface PayPalCapture {
  id: string;
  status: string;
  purchaseUnits?: {
    payments?: {
      captures?: { id: string; status: string; amount?: { currencyCode: string; value: string } }[];
    };
  }[];
}

/**
 * Cliente mínimo de la API REST de PayPal.
 *
 * Se usan sólo tres operaciones —crear un pago, capturarlo y verificar la
 * firma de un webhook—, así que un cliente propio sobre `fetch` resulta más
 * predecible que arrastrar el SDK oficial, que es código generado y cambia de
 * forma con cada versión mayor.
 *
 * El token de aplicación se guarda en memoria hasta poco antes de caducar,
 * para no pedir uno nuevo en cada llamada.
 */
@Injectable()
export class PayPalClient {
  private readonly logger = new Logger(PayPalClient.name);
  private token?: { value: string; expiresAt: number };

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return (
      this.config.get<boolean>('paypal.enabled') === true &&
      Boolean(this.config.get<string>('paypal.clientId')) &&
      Boolean(this.config.get<string>('paypal.clientSecret'))
    );
  }

  get currency(): string {
    return this.config.getOrThrow<string>('paypal.currency');
  }

  /** Crea un pago y devuelve el enlace al que debe ir el comprador. */
  async createOrder(params: {
    amount: string;
    currency: string;
    referenceId: string;
    description: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<PayPalOrder> {
    return this.request<PayPalOrder>('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          description: params.description.slice(0, 127),
          amount: { currency_code: params.currency, value: params.amount },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: params.returnUrl,
            cancel_url: params.cancelUrl,
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
          },
        },
      },
    });
  }

  async captureOrder(orderId: string): Promise<PayPalCapture> {
    return this.request<PayPalCapture>('POST', `/v2/checkout/orders/${orderId}/capture`, {});
  }

  async getOrder(orderId: string): Promise<PayPalOrder> {
    return this.request<PayPalOrder>('GET', `/v2/checkout/orders/${orderId}`);
  }

  /**
   * Pregunta a PayPal si la firma de un webhook es auténtica.
   *
   * Sin esta comprobación cualquiera podría enviar a nuestro endpoint un aviso
   * de "pago completado" y llevarse el pedido sin pagarlo.
   */
  async verifyWebhook(params: {
    webhookId: string;
    headers: Record<string, string | undefined>;
    body: unknown;
  }): Promise<boolean> {
    const required = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ] as const;

    if (required.some((header) => !params.headers[header])) {
      return false;
    }

    try {
      const result = await this.request<{ verification_status: string }>(
        'POST',
        '/v1/notifications/verify-webhook-signature',
        {
          auth_algo: params.headers['paypal-auth-algo'],
          cert_url: params.headers['paypal-cert-url'],
          transmission_id: params.headers['paypal-transmission-id'],
          transmission_sig: params.headers['paypal-transmission-sig'],
          transmission_time: params.headers['paypal-transmission-time'],
          webhook_id: params.webhookId,
          webhook_event: params.body,
        },
      );

      return result.verification_status === 'SUCCESS';
    } catch (error) {
      this.logger.warn(`No se pudo verificar la firma del webhook: ${describe(error)}`);

      return false;
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!this.enabled) {
      throw new AppException(
        ErrorCode.PaymentFailed,
        501,
        'PayPal is not configured on this server',
      );
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    const text = await response.text();

    if (!response.ok) {
      this.logger.error(`PayPal ${method} ${path} -> ${response.status} ${text.slice(0, 500)}`);

      throw new AppException(
        ErrorCode.PaymentFailed,
        502,
        `PayPal rejected the request with status ${response.status}`,
      );
    }

    return (text ? JSON.parse(text) : {}) as T;
  }

  private async accessToken(): Promise<string> {
    // Se renueva un minuto antes de que caduque, para que ninguna petición se
    // encuentre con un token recién expirado.
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.value;
    }

    const clientId = this.config.getOrThrow<string>('paypal.clientId');
    const clientSecret = this.config.getOrThrow<string>('paypal.clientSecret');
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${basic}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new AppException(
        ErrorCode.PaymentFailed,
        502,
        `PayPal authentication failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as { access_token: string; expires_in: number };

    this.token = {
      value: payload.access_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
    };

    return this.token.value;
  }

  private get baseUrl(): string {
    const environment = this.config.getOrThrow<'sandbox' | 'production'>('paypal.environment');

    return API_BASE[environment];
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
