import { Global, Module } from '@nestjs/common';

import { PostViewService } from './post-view.service.js';
import { ProfileService } from './profile.service.js';
import { RelationshipService } from './relationship.service.js';
import { SocialResolver } from './social.resolver.js';
import { SocialService } from './social.service.js';

/**
 * Las reglas de relación entre personas y lo que se deriva de ellas.
 *
 * Global porque las usan todos los que enseñan contenido ajeno: el muro, las
 * historias, el chat, los directos.
 */
@Global()
@Module({
  providers: [RelationshipService, ProfileService, PostViewService, SocialService, SocialResolver],
  exports: [RelationshipService, ProfileService, PostViewService, SocialService],
})
export class SocialModule {}
