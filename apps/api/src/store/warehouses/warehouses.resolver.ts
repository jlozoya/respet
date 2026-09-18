import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Paginated, Warehouse } from '@social-network/shared';

import { Public, Roles } from '../../common/decorators/index.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import { WarehousePage, WarehouseType } from '../../graphql/types/store.types.js';
import { GraphQLUpload, type PendingUpload } from '../../media/upload.js';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseListQueryDto,
} from './dto/warehouse.dto.js';
import { WarehousesService } from './warehouses.service.js';

@Resolver(() => WarehouseType)
export class WarehousesResolver {
  constructor(private readonly warehouses: WarehousesService) {}

  @Public()
  @Query(() => WarehousePage, { name: 'warehouses' })
  async list(
    @Args('query', { type: () => WarehouseListQueryDto, nullable: true })
    query: WarehouseListQueryDto = {},
  ): Promise<Paginated<Warehouse>> {
    return this.warehouses.list(query);
  }

  @Public()
  @Query(() => WarehouseType, { name: 'warehouse' })
  async findOne(@Args('id', { type: () => ID }, ParseObjectIdPipe) id: string): Promise<Warehouse> {
    return this.warehouses.findById(id);
  }

  @Roles('supervisor')
  @Mutation(() => WarehouseType)
  async createWarehouse(@Args('input') input: CreateWarehouseDto): Promise<Warehouse> {
    return this.warehouses.create(input);
  }

  @Roles('supervisor')
  @Mutation(() => WarehouseType)
  async updateWarehouse(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    return this.warehouses.update(id, input);
  }

  @Roles('supervisor')
  @Mutation(() => WarehouseType, {
    description: 'Cambia la imagen de la bodega, subida en la propia operación.',
  })
  async setWarehouseImage(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args({ name: 'file', type: () => GraphQLUpload }) file: PendingUpload,
  ): Promise<Warehouse> {
    return this.warehouses.setImage(id, file);
  }

  @Roles('admin')
  @Mutation(() => Boolean, { description: 'Borra una bodega vacía.' })
  async deleteWarehouse(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<boolean> {
    await this.warehouses.remove(id);

    return true;
  }
}
