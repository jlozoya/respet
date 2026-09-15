import { Controller, Param, Put, UploadedFile } from '@nestjs/common';
import type { Bulletin } from '@respet/shared';

import { Roles } from '../common/decorators/index.js';
import { UploadImage } from '../common/interceptors/image-upload.interceptor.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { BulletinsService } from './bulletins.service.js';

/** La imagen del aviso, que por ser un archivo no cabe en el esquema. */
@Controller('bulletins')
export class BulletinsController {
  constructor(private readonly bulletins: BulletinsService) {}

  @Roles('admin')
  @Put(':id/media')
  @UploadImage()
  async setImage(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Bulletin> {
    return this.bulletins.setImage(id, file);
  }
}
