import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Paginated, Warehouse as WarehouseDto } from '@respet/shared';
import { isValidObjectId } from '../../database/mongoose.js';
import type { Model } from '../../database/mongoose.js';

import { AppException, ErrorCode } from '../../common/errors.js';
import { toWarehouse } from '../../common/mappers.js';
import { upsertLocation } from '../../common/utils/location.js';
import { paginate, toPage } from '../../common/utils/pagination.js';
import { escapeRegex } from '../../common/utils/regex.js';
import { Location } from '../../database/schemas/content.schema.js';
import { Product, Warehouse } from '../../database/schemas/store.schema.js';
import { MediaService } from '../../media/media.service.js';
import type {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseListQueryDto,
} from './dto/warehouse.dto.js';

/** Relaciones que hacen falta para pintar una bodega entera. */
const POBLAR = [{ path: 'location' }, { path: 'media' }];

@Injectable()
export class WarehousesService {
  constructor(
    @InjectModel(Warehouse.name) private readonly warehouses: Model<Warehouse>,
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(Location.name) private readonly locations: Model<Location>,
    private readonly media: MediaService,
  ) {}

  async list(query: WarehouseListQueryDto): Promise<Paginated<WarehouseDto>> {
    const { skip, take, page, perPage } = toPage(query);
    const search = query.search?.trim();
    const where = search
      ? {
          $or: [
            { name: { $regex: escapeRegex(search), $options: 'i' } },
            { description: { $regex: escapeRegex(search), $options: 'i' } },
          ],
        }
      : {};

    const [docs, total] = await Promise.all([
      this.warehouses
        .find(where)
        .sort({ name: 1 })
        .skip(skip)
        .limit(take)
        .populate(POBLAR)
        .lean(),
      this.warehouses.countDocuments(where),
    ]);

    return paginate(docs.map((doc) => toWarehouse(doc as never)), total, page, perPage);
  }

  async findById(id: string): Promise<WarehouseDto> {
    return toWarehouse((await this.findDocOrFail(id)) as never);
  }

  async create(dto: CreateWarehouseDto): Promise<WarehouseDto> {
    const locationId = await upsertLocation(this.locations, null, dto.location);

    const created = await this.warehouses.create({
      name: dto.name,
      description: dto.description ?? null,
      locationId: locationId ?? null,
    });

    return this.findById(String(created._id));
  }

  async update(id: string, dto: UpdateWarehouseDto): Promise<WarehouseDto> {
    const current = await this.findDocOrFail(id);

    const locationId = await upsertLocation(
      this.locations,
      current.locationId ? String(current.locationId) : null,
      dto.location,
    );

    await this.warehouses.updateOne(
      { _id: id },
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(locationId !== undefined ? { locationId } : {}),
        },
      },
    );

    return this.findById(id);
  }

  async setImage(id: string, file: Express.Multer.File): Promise<WarehouseDto> {
    const current = await this.findDocOrFail(id);
    const created = await this.media.createFromUpload(file, 'warehouse', { alt: current.name });

    await this.warehouses.updateOne({ _id: id }, { $set: { mediaId: created.id } });

    // La anterior se borra después de apuntar la nueva, para que la bodega no
    // se quede sin imagen si algo falla por el camino.
    if (current.mediaId) {
      await this.media.remove(String(current.mediaId));
    }

    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    const warehouse = await this.findDocOrFail(id);
    const productos = await this.products.countDocuments({ warehouseId: id });

    if (productos > 0) {
      // Borrarla dejaría los productos sin bodega en silencio, y con ellos el
      // inventario descuadrado. Mejor obligar a moverlos antes.
      throw AppException.conflict(
        ErrorCode.Conflict,
        `The warehouse still holds ${productos} products; move them first`,
      );
    }

    await this.warehouses.deleteOne({ _id: id });

    if (warehouse.mediaId) {
      await this.media.remove(String(warehouse.mediaId));
    }
  }

  private async findDocOrFail(id: string): Promise<Warehouse & { _id: unknown }> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Warehouse');
    }

    const doc = await this.warehouses.findById(id).populate(POBLAR).lean();

    if (!doc) {
      throw AppException.notFound('Warehouse');
    }

    return doc as Warehouse & { _id: unknown };
  }
}
