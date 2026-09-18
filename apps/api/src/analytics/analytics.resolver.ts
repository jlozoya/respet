import { Args, Query, Resolver } from '@nestjs/graphql';
import type { Analytics, UsersRegistrationPoint } from '@social-network/shared';

import { Roles } from '../common/decorators/index.js';
import { AnalyticsType, UsersRegistrationPointType } from '../graphql/types/content.types.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsQueryDto } from './dto/analytics.dto.js';

@Roles('admin')
@Resolver(() => AnalyticsType)
export class AnalyticsResolver {
  constructor(private readonly analytics: AnalyticsService) {}

  @Query(() => AnalyticsType, { name: 'analytics', description: 'Cifras generales.' })
  async summary(): Promise<Analytics> {
    return this.analytics.summary();
  }

  @Query(() => [UsersRegistrationPointType], {
    name: 'usersRegistration',
    description: 'Altas de usuarios agrupadas por intervalo.',
  })
  async usersRegistration(
    @Args('query', { type: () => AnalyticsQueryDto, nullable: true })
    query: AnalyticsQueryDto = {},
  ): Promise<UsersRegistrationPoint[]> {
    return this.analytics.usersRegistration(query);
  }
}
