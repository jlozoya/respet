import { Controller, Param, Put, UploadedFile } from '@nestjs/common';
import type { Media } from '@respet/shared';

import { CurrentUser, Roles } from '../common/decorators/index.js';
import { UploadImage } from '../common/interceptors/image-upload.interceptor.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { UsersService } from './users.service.js';

/**
 * La foto de perfil, propia o ajena.
 *
 * Lo único de los usuarios que sigue siendo REST: un archivo no viaja dentro
 * de una consulta de GraphQL. La ruta de la propia va antes que la de `:id`
 * porque Nest resuelve por orden de declaración y, si no, «me» acabaría
 * entrando por el parámetro.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Put('me/avatar')
  @UploadImage()
  async updateMyAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Media> {
    return this.users.updateAvatar(userId, file);
  }

  @Roles('admin')
  @Put(':id/avatar')
  @UploadImage()
  async updateAvatar(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Media> {
    return this.users.updateAvatar(id, file);
  }
}
