import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Bulletin as BulletinDto, Paginated } from '@respet/shared';
import { isValidObjectId } from '../database/mongoose.js';
import type { Model } from '../database/mongoose.js';

import { AppException } from '../common/errors.js';
import { toBulletin } from '../common/mappers.js';
import { paginate, toPage } from '../common/utils/pagination.js';
import { escapeRegex } from '../common/utils/regex.js';
import { Bulletin } from '../database/schemas/content.schema.js';
import { MediaService } from '../media/media.service.js';
import type {
  BulletinListQueryDto,
  CreateBulletinDto,
  UpdateBulletinDto,
} from './dto/bulletin.dto.js';

@Injectable()
export class BulletinsService {
  constructor(
    @InjectModel(Bulletin.name) private readonly bulletins: Model<Bulletin>,
    private readonly media: MediaService,
  ) {}

  async list(query: BulletinListQueryDto): Promise<Paginated<BulletinDto>> {
    const { skip, take, page, perPage } = toPage(query);
    const search = query.search?.trim();
    const where = search
      ? {
          $or: [
            { title: { $regex: escapeRegex(search), $options: 'i' } },
            { description: { $regex: escapeRegex(search), $options: 'i' } },
          ],
        }
      : {};

    const [docs, total] = await Promise.all([
      this.bulletins
        .find(where)
        .sort({ date: -1 })
        .skip(skip)
        .limit(take)
        .populate('media')
        .lean(),
      this.bulletins.countDocuments(where),
    ]);

    return paginate(docs.map((doc) => toBulletin(doc as never)), total, page, perPage);
  }

  async findById(id: string): Promise<BulletinDto> {
    return toBulletin((await this.findDocOrFail(id)) as never);
  }

  async create(dto: CreateBulletinDto): Promise<BulletinDto> {
    const created = await this.bulletins.create({
      title: dto.title,
      description: dto.description,
      date: new Date(dto.date),
    });

    return this.findById(String(created._id));
  }

  async update(id: string, dto: UpdateBulletinDto): Promise<BulletinDto> {
    await this.assertExists(id);

    await this.bulletins.updateOne(
      { _id: id },
      {
        $set: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.date !== undefined ? { date: new Date(dto.date) } : {}),
        },
      },
    );

    return this.findById(id);
  }

  async setImage(id: string, file: Express.Multer.File): Promise<BulletinDto> {
    const current = await this.findDocOrFail(id);
    const created = await this.media.createFromUpload(file, 'bulletin', { alt: current.title });

    await this.bulletins.updateOne({ _id: id }, { $set: { mediaId: created.id } });

    // La anterior se borra después de apuntar la nueva, para que el aviso no se
    // quede sin imagen si algo falla por el camino.
    if (current.mediaId) {
      await this.media.remove(String(current.mediaId));
    }

    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    const bulletin = await this.findDocOrFail(id);

    await this.bulletins.deleteOne({ _id: id });

    if (bulletin.mediaId) {
      await this.media.remove(String(bulletin.mediaId));
    }
  }

  private async findDocOrFail(id: string): Promise<Bulletin & { _id: unknown }> {
    if (!isValidObjectId(id)) {
      throw AppException.notFound('Bulletin');
    }

    const doc = await this.bulletins.findById(id).populate('media').lean();

    if (!doc) {
      throw AppException.notFound('Bulletin');
    }

    return doc as Bulletin & { _id: unknown };
  }

  private async assertExists(id: string): Promise<void> {
    if (!isValidObjectId(id) || !(await this.bulletins.exists({ _id: id }))) {
      throw AppException.notFound('Bulletin');
    }
  }
}
