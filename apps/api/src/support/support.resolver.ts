import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Paginated, SupportTicket } from '@social-network/shared';

import { Public, RateLimit, Roles } from '../common/decorators/index.js';
import { SupportTicketPage, SupportTicketType } from '../graphql/types/content.types.js';
import { CreateSupportDto, SupportListQueryDto } from './dto/support.dto.js';
import { SupportService } from './support.service.js';

@Resolver(() => SupportTicketType)
export class SupportResolver {
  constructor(private readonly support: SupportService) {}

  @Public()
  @RateLimit({ limit: 3, windowSeconds: 3600 })
  @Mutation(() => SupportTicketType, {
    description: 'Envía un mensaje desde el formulario de contacto.',
  })
  async createSupportTicket(@Args('input') input: CreateSupportDto): Promise<SupportTicket> {
    return this.support.create(input);
  }

  @Roles('admin')
  @Query(() => SupportTicketPage, { name: 'supportTickets' })
  async list(
    @Args('query', { type: () => SupportListQueryDto, nullable: true })
    query: SupportListQueryDto = {},
  ): Promise<Paginated<SupportTicket>> {
    return this.support.list(query);
  }
}
