import { Args, Field, ID, InputType, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { CreateReportRequest, Paginated, Report } from '@respet/shared';
import { Transform } from 'class-transformer';
import { IsEnum, IsMongoId, IsString, Length } from 'class-validator';

import { CurrentUser, RateLimit, Roles } from '../common/decorators/index.js';
import { trim } from '../common/dto/transforms.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { ReportStatus, ReportTarget } from '../graphql/enums.js';
import { ReportPage } from '../graphql/types/social.types.js';
import { ModerationService } from './moderation.service.js';

@InputType('ReportContentInput')
export class ReportContentDto implements CreateReportRequest {
  @Field(() => ReportTarget)
  @IsEnum(ReportTarget)
  targetType!: ReportTarget;

  @Field(() => ID)
  @IsMongoId()
  targetId!: string;

  @Field({ description: 'Motivo, tal y como lo escribe quien denuncia.' })
  @Transform(trim)
  @IsString()
  @Length(3, 500)
  reason!: string;
}

@Resolver()
export class ModerationResolver {
  constructor(private readonly moderation: ModerationService) {}

  @RateLimit({ limit: 30, windowSeconds: 3600 })
  @Mutation(() => Boolean, { description: 'Denuncia una publicación, comentario, persona, historia, mensaje o directo.' })
  async reportContent(@CurrentUser('id') userId: string, @Args('input') input: ReportContentDto): Promise<boolean> {
    await this.moderation.report(userId, input.targetType, input.targetId, input.reason);

    return true;
  }

  @Roles('supervisor')
  @Query(() => ReportPage, { name: 'reports' })
  async reports(
    @Args('status', { type: () => ReportStatus, nullable: true }) status?: ReportStatus,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page = 1,
    @Args('perPage', { type: () => Int, nullable: true, defaultValue: 20 }) perPage = 20,
  ): Promise<Paginated<Report>> {
    return this.moderation.list(status, page, perPage);
  }

  @Roles('supervisor')
  @Mutation(() => Boolean, { description: 'Marca una denuncia —y las iguales— como revisada o descartada.' })
  async resolveReport(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('status', { type: () => ReportStatus }) status: ReportStatus,
    @CurrentUser('id') reviewerId: string,
  ): Promise<boolean> {
    await this.moderation.resolve(id, status, reviewerId);

    return true;
  }
}
