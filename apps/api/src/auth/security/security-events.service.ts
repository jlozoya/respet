import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Paginated, SecurityEvent as SecurityEventDto } from '@respet/shared';

import type { ClientInfo } from '../../common/decorators/index.js';
import { toIso } from '../../common/mappers.js';
import { paginate, toPage } from '../../common/utils/pagination.js';
import type { Model } from '../../database/mongoose.js';
import type { SecurityEventType } from '../../database/schemas/enums.js';
import { SecurityEvent } from '../../database/schemas/user.schema.js';
import { parseUserAgent } from '../session/device.js';

/** Medio año, que es lo que se guarda el registro. */
const RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * El registro de actividad de seguridad de cada cuenta.
 *
 * Escribir aquí nunca hace fallar la operación que se registra: si la base
 * tarda o falla al apuntar un inicio de sesión, la persona tiene que poder
 * entrar igualmente.
 */
@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(@InjectModel(SecurityEvent.name) private readonly events: Model<SecurityEvent>) {}

  async record(
    userId: string,
    type: SecurityEventType,
    client: Partial<ClientInfo> = {},
    metadata: Record<string, unknown> | null = null,
  ): Promise<void> {
    try {
      await this.events.create({
        userId,
        type,
        ip: client.ip ?? null,
        device: client.userAgent ? parseUserAgent(client.userAgent) : null,
        metadata,
        expiresAt: new Date(Date.now() + RETENTION_MS),
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar el evento ${type} de ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async list(userId: string, page = 1, perPage = 20): Promise<Paginated<SecurityEventDto>> {
    const pagination = toPage({ page, perPage });

    const [docs, total] = await Promise.all([
      this.events
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.take)
        .lean(),
      this.events.countDocuments({ userId }),
    ]);

    return paginate(
      docs.map((doc) => ({
        id: String(doc._id),
        type: doc.type,
        ip: doc.ip,
        device: doc.device ?? null,
        detail: describeMetadata(doc.metadata),
        createdAt: toIso(doc.createdAt),
      })),
      total,
      pagination.page,
      pagination.perPage,
    );
  }
}

/**
 * Lo que se enseña de los detalles de un evento.
 *
 * Sólo lo que tiene sentido leer —el nombre de una aplicación, el motivo de un
 * cierre—; el resto de lo guardado queda para quien investigue.
 */
function describeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) {
    return null;
  }

  for (const key of ['appName', 'reason', 'method', 'device']) {
    const value = metadata[key];

    if (typeof value === 'string' && value) {
      return value;
    }
  }

  return null;
}
