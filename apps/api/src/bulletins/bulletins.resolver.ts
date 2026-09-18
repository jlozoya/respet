import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Bulletin, Paginated } from '@social-network/shared';

import { Public, Roles } from '../common/decorators/index.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { BulletinPage, BulletinType } from '../graphql/types/content.types.js';
import { GraphQLUpload, type PendingUpload } from '../media/upload.js';
import { BulletinsService } from './bulletins.service.js';
import { BulletinListQueryDto, CreateBulletinDto, UpdateBulletinDto } from './dto/bulletin.dto.js';

@Resolver(() => BulletinType)
export class BulletinsResolver {
  constructor(private readonly bulletins: BulletinsService) {}

  @Public()
  @Query(() => BulletinPage, {
    name: 'bulletins',
    description: 'Avisos publicados, del más reciente al más antiguo.',
  })
  async list(
    @Args('query', { type: () => BulletinListQueryDto, nullable: true })
    query: BulletinListQueryDto = {},
  ): Promise<Paginated<Bulletin>> {
    return this.bulletins.list(query);
  }

  @Public()
  @Query(() => BulletinType, { name: 'bulletin' })
  async findOne(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<Bulletin> {
    return this.bulletins.findById(id);
  }

  @Roles('admin')
  @Mutation(() => BulletinType)
  async createBulletin(@Args('input') input: CreateBulletinDto): Promise<Bulletin> {
    return this.bulletins.create(input);
  }

  @Roles('admin')
  @Mutation(() => BulletinType)
  async updateBulletin(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateBulletinDto,
  ): Promise<Bulletin> {
    return this.bulletins.update(id, input);
  }

  @Roles('admin')
  @Mutation(() => BulletinType, { description: 'Cambia la imagen del aviso, subida en la propia operación.' })
  async setBulletinImage(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
  ): Promise<Bulletin> {
    return this.bulletins.setImage(id, file);
  }

  @Roles('admin')
  @Mutation(() => Boolean)
  async deleteBulletin(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<boolean> {
    await this.bulletins.remove(id);

    return true;
  }
}
