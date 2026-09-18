import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Paginated, SupportTicket as SupportTicketDto } from '@social-network/shared';
import type { Model } from '../database/mongoose.js';

import { toSupportTicket } from '../common/mappers.js';
import { escapeRegex } from '../common/utils/regex.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { SupportTicket } from '../database/schemas/content.schema.js';
import { MailService } from '../mail/mail.service.js';
import type { CreateSupportDto, SupportListQueryDto } from './dto/support.dto.js';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name) private readonly tickets: Model<SupportTicket>,
    private readonly mail: MailService,
  ) {}

  async create(dto: CreateSupportDto): Promise<SupportTicketDto> {
    const doc = await this.tickets.create({
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? null,
      message: dto.message,
      lang: dto.lang ?? 'es',
    });

    // Los correos van después de guardar y sin `await` sobre su resultado:
    // que el servidor de correo falle no debe perder el mensaje ni devolver
    // un error a quien acaba de escribirnos.
    void this.mail.sendSupportConfirmation(doc.email, doc.name, doc.lang);
    void this.mail.sendSupportNotification({
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      message: doc.message,
    });

    return toSupportTicket(doc.toObject() as never);
  }

  async list(query: SupportListQueryDto): Promise<Paginated<SupportTicketDto>> {
    const { skip, take, page, perPage } = toPage(query);
    const search = query.search?.trim();
    const where = search
      ? {
          $or: [
            { name: { $regex: escapeRegex(search), $options: 'i' } },
            { email: { $regex: escapeRegex(search), $options: 'i' } },
            { message: { $regex: escapeRegex(search), $options: 'i' } },
          ],
        }
      : {};

    const [docs, total] = await Promise.all([
      this.tickets.find(where).sort({ createdAt: -1 }).skip(skip).limit(take).lean(),
      this.tickets.countDocuments(where),
    ]);

    return paginate(docs.map((doc) => toSupportTicket(doc as never)), total, page, perPage);
  }
}
