import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Media, Paginated, Product as ProductDto } from '@respet/shared';
import { isValidObjectId } from '../../database/mongoose.js';
import type { Model } from '../../database/mongoose.js';

import { AppException, ErrorCode } from '../../common/errors.js';
import { POPULATE_PRODUCT, toCents, toMedia, toProduct } from '../../common/mappers.js';
import { paginate, toPage } from '../../common/utils/pagination.js';
import { escapeRegex } from '../../common/utils/regex.js';
import { Media as MediaDoc } from '../../database/schemas/content.schema.js';
import { OrderItem, Product } from '../../database/schemas/store.schema.js';
import { MediaService } from '../../media/media.service.js';
import type { CreateProductDto, ProductListQueryDto, UpdateProductDto } from './dto/product.dto.js';

const MAX_MEDIA_PER_PRODUCT = 8;

/** Filtro de búsqueda, tal y como lo entiende `find`. */
type Filtro = Record<string, unknown>;

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<Product>,
    @InjectModel(OrderItem.name) private readonly orderItems: Model<OrderItem>,
    @InjectModel(MediaDoc.name) private readonly mediaModel: Model<MediaDoc>,
    private readonly media: MediaService,
  ) {}

  async list(query: ProductListQueryDto): Promise<Paginated<ProductDto>> {
    const { skip, take, page, perPage } = toPage(query);
    const filtros: Filtro[] = [];

    if (query.warehouseId) {
      filtros.push({ warehouseId: query.warehouseId });
    }

    if (query.search?.trim()) {
      const search = escapeRegex(query.search.trim());

      filtros.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const where: Filtro = filtros.length > 0 ? { $and: filtros } : {};

    const [docs, total] = await Promise.all([
      this.products
        .find(where)
        .sort({ name: 1 })
        .skip(skip)
        .limit(take)
        .populate(POPULATE_PRODUCT)
        .lean(),
      this.products.countDocuments(where),
    ]);

    return paginate(docs.map((doc) => toProduct(doc as never)), total, page, perPage);
  }

  async findById(id: string): Promise<ProductDto> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Product');
    }

    const doc = await this.products.findById(id).populate(POPULATE_PRODUCT).lean();

    if (!doc) {
      throw AppException.notFound('Product');
    }

    return toProduct(doc as never);
  }

  async create(dto: CreateProductDto): Promise<ProductDto> {
    const created = await this.products.create({
      name: dto.name,
      description: dto.description,
      stock: dto.stock,
      // Hacia fuera los precios van en pesos; dentro se guardan en céntimos.
      price: toCents(dto.price),
      warehouseId: dto.warehouseId ?? null,
    });

    return this.findById(String(created._id));
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDto> {
    await this.assertExists(id);

    await this.products.updateOne(
      { _id: id },
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.stock !== undefined ? { stock: dto.stock } : {}),
          ...(dto.price !== undefined ? { price: toCents(dto.price) } : {}),
          ...(dto.warehouseId !== undefined ? { warehouseId: dto.warehouseId } : {}),
        },
      },
    );

    return this.findById(id);
  }

  async addMedia(id: string, file: Express.Multer.File): Promise<Media> {
    const product = await this.products.findById(id).select('name').lean();

    if (!product) {
      throw AppException.notFound('Product');
    }

    const imagenes = await this.mediaModel.countDocuments({ productId: id });

    if (imagenes >= MAX_MEDIA_PER_PRODUCT) {
      throw AppException.badRequest(
        ErrorCode.ValidationFailed,
        `A product cannot have more than ${MAX_MEDIA_PER_PRODUCT} images`,
      );
    }

    const created = await this.media.createFromUpload(file, 'product', {
      productId: id,
      position: imagenes,
      alt: product.name,
    });

    const doc = await this.mediaModel.findById(created.id).lean();

    if (!doc) {
      throw AppException.notFound('Media');
    }

    return toMedia(doc as never);
  }

  async removeMedia(id: string, mediaId: string): Promise<void> {
    // El filtro por producto es lo que impide borrar la imagen de otro pasando
    // un identificador ajeno.
    const media = await this.mediaModel.exists({ _id: mediaId, productId: id });

    if (!media) {
      throw AppException.notFound('Media');
    }

    await this.media.remove(mediaId);
  }

  async remove(id: string): Promise<void> {
    await this.assertExists(id);

    const vendido = await this.orderItems.countDocuments({ productId: id });

    if (vendido > 0) {
      // En SQL esto lo impedía una clave foránea con `Restrict`. Aquí no hay
      // quien lo impida, así que se comprueba a mano: borrar un producto
      // vendido rompería el historial de pedidos.
      throw AppException.conflict(
        ErrorCode.Conflict,
        'The product appears in existing orders and cannot be deleted; set its stock to zero instead',
      );
    }

    const imagenes = await this.mediaModel.find({ productId: id }).select('_id').lean();

    await this.products.deleteOne({ _id: id });
    await this.media.removeMany(imagenes.map((doc) => String(doc._id)));
  }

  private async assertExists(id: string): Promise<void> {
    if (!isValidObjectId(id) || !(await this.products.exists({ _id: id }))) {
      throw AppException.notFound('Product');
    }
  }
}
