import { Field, InputType } from '@nestjs/graphql';
import type { AnalyticsQuery } from '@social-network/shared';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

import { RegistrationInterval } from '../../graphql/enums.js';

export type { RegistrationInterval };

@InputType('AnalyticsQueryInput')
export class AnalyticsQueryDto implements AnalyticsQuery {
  @Field(() => RegistrationInterval, { nullable: true })
  @IsOptional()
  @IsEnum(RegistrationInterval)
  interval?: RegistrationInterval;

  @Field(() => String, { nullable: true, description: 'Desde, en formato ISO-8601.' })
  @IsOptional()
  @IsDateString({ strict: false })
  from?: string;

  @Field(() => String, { nullable: true, description: 'Hasta, en formato ISO-8601.' })
  @IsOptional()
  @IsDateString({ strict: false })
  to?: string;
}
