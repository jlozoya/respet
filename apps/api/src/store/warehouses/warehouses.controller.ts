import { Controller, Param, Put, UploadedFile } from '@nestjs/common';
import type { Warehouse } from '@respet/shared';

import { Roles } from '../../common/decorators/index.js';
import { UploadImage } from '../../common/interceptors/image-upload.interceptor.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { WarehousesService } from './warehouses.service.js';

/** La imagen de la bodega: un archivo, así que sigue entrando por REST. */
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Roles('supervisor')
  @Put(':id/media')
  @UploadImage()
  async setImage(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Warehouse> {
    return this.warehouses.setImage(id, file);
  }
}
