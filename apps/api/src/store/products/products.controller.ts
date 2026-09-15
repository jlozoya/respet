import { Controller, Param, Post, UploadedFile } from '@nestjs/common';
import type { Media } from '@respet/shared';

import { Roles } from '../../common/decorators/index.js';
import { UploadImage } from '../../common/interceptors/image-upload.interceptor.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { ProductsService } from './products.service.js';

/** Añadir una foto al producto: el archivo no cabe en una consulta. */
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Roles('supervisor')
  @Post(':id/media')
  @UploadImage()
  async addMedia(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Media> {
    return this.products.addMedia(id, file);
  }
}
