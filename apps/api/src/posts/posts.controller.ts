import { Controller, Param, Post as HttpPost, UploadedFile } from '@nestjs/common';
import type { Media } from '@respet/shared';

import { CurrentUser, type AuthenticatedUser } from '../common/decorators/index.js';
import { UploadImage } from '../common/interceptors/image-upload.interceptor.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { PostsService } from './posts.service.js';

/**
 * Lo único del muro que no pasa por GraphQL: subir una foto.
 *
 * El archivo viaja como `multipart/form-data`, que GraphQL no transporta sin
 * añadir una extensión al protocolo y otra librería en el cliente. Sale más
 * barato dejar la subida donde estaba —una ruta que recibe el archivo y
 * devuelve el `Media` creado— y que todo lo demás sea una operación del
 * esquema.
 */
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @HttpPost(':id/media')
  @UploadImage()
  async addMedia(
    @Param('id', ParseObjectIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Media> {
    return this.posts.addMedia(id, file, actor);
  }
}
