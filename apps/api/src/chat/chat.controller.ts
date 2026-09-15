import { Controller, Param, Post, UploadedFile } from '@nestjs/common';
import type { Message } from '@respet/shared';

import { CurrentUser } from '../common/decorators/index.js';
import { UploadImage } from '../common/interceptors/image-upload.interceptor.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';

/**
 * Enviar una imagen por el chat, que es lo único que no cabe en el esquema.
 *
 * Como el resto de escrituras del chat, guarda primero y anuncia después: el
 * mensaje existe aunque el socket de quien lo recibe esté caído.
 */
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly gateway: ChatGateway,
  ) {}

  @Post('conversations/:id/images')
  @UploadImage()
  async sendImage(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ): Promise<Message> {
    const message = await this.chat.sendImage(id, userId, file);
    await this.gateway.emitMessage(message, userId);

    return message;
  }
}
