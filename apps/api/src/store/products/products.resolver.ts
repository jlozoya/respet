import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Media, Paginated, Product } from '@social-network/shared';

import { Public, Roles } from '../../common/decorators/index.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { MediaType } from '../../graphql/types/common.types.js';
import { GraphQLUpload, type PendingUpload } from '../../media/upload.js';
import { ProductPage, ProductType } from '../../graphql/types/store.types.js';
import { CreateProductDto, ProductListQueryDto, UpdateProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

@Resolver(() => ProductType)
export class ProductsResolver {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Query(() => ProductPage, { name: 'products', description: 'Catálogo.' })
  async list(
    @Args('query', { type: () => ProductListQueryDto, nullable: true })
    query: ProductListQueryDto = {},
  ): Promise<Paginated<Product>> {
    return this.products.list(query);
  }

  @Public()
  @Query(() => ProductType, { name: 'product' })
  async findOne(@Args('id', { type: () => ID }, ParseObjectIdPipe) id: string): Promise<Product> {
    return this.products.findById(id);
  }

  @Roles('supervisor')
  @Mutation(() => ProductType)
  async createProduct(@Args('input') input: CreateProductDto): Promise<Product> {
    return this.products.create(input);
  }

  @Roles('supervisor')
  @Mutation(() => ProductType)
  async updateProduct(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateProductDto,
  ): Promise<Product> {
    return this.products.update(id, input);
  }

  @Roles('supervisor')
  @Mutation(() => MediaType, {
    description: 'Añade una foto al producto, subida en la propia operación.',
  })
  async addProductMedia(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
  ): Promise<Media> {
    return this.products.addMedia(id, file);
  }

  @Roles('supervisor')
  @Mutation(() => Boolean)
  async removeProductMedia(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('mediaId', { type: () => ID }, ParseObjectIdPipe) mediaId: string,
  ): Promise<boolean> {
    await this.products.removeMedia(id, mediaId);

    return true;
  }

  @Roles('admin')
  @Mutation(() => Boolean, { description: 'Borra un producto que no aparezca en ningún pedido.' })
  async deleteProduct(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<boolean> {
    await this.products.remove(id);

    return true;
  }
}
