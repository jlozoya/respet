import { Field, ID, InputType, Int } from '@nestjs/graphql';
import type {
  AddOrderItemRequest,
  CreateOrderRequest,
  UpdateOrderItemRequest,
  UpdateOrderRequest,
  UpdateOrderStateRequest,
} from '@respet/shared';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { LocationDto } from '../../../common/dto/location.dto.js';
import { SearchQueryDto } from '../../../common/dto/pagination.dto.js';
import { OrderState } from '../../../graphql/enums.js';

/** Unidades máximas de un mismo producto en una línea de pedido. */
const MAX_QUANTITY = 999;

@InputType('CreateOrderInput')
export class CreateOrderDto implements CreateOrderRequest {
  @Field(() => LocationDto, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  destination?: LocationDto | null;
}

@InputType('UpdateOrderInput')
export class UpdateOrderDto implements UpdateOrderRequest {
  @Field(() => LocationDto, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  destination?: LocationDto | null;

  @Field(() => String, { nullable: true, description: 'Fecha de recogida, en ISO-8601.' })
  @IsOptional()
  @IsDateString({ strict: false })
  takeOutDate?: string | null;

  @Field(() => String, { nullable: true, description: 'Fecha de entrega, en ISO-8601.' })
  @IsOptional()
  @IsDateString({ strict: false })
  deliveryDate?: string | null;
}

@InputType('UpdateOrderStateInput')
export class UpdateOrderStateDto implements UpdateOrderStateRequest {
  @Field(() => OrderState)
  @IsEnum(OrderState)
  state!: OrderState;

  @Field(() => ID, { nullable: true, description: 'Repartidor asignado.' })
  @IsOptional()
  @IsMongoId()
  roundsmanId?: string | null;
}

@InputType('AddOrderItemInput')
export class AddOrderItemDto implements AddOrderItemRequest {
  @Field(() => ID)
  @IsMongoId()
  productId!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity!: number;
}

@InputType('UpdateOrderItemInput')
export class UpdateOrderItemDto implements UpdateOrderItemRequest {
  @Field(() => Int, { description: 'Con 0 se elimina la línea del pedido.' })
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY)
  quantity!: number;
}

@InputType('OrderListQueryInput')
export class OrderListQueryDto extends SearchQueryDto {
  @Field(() => OrderState, { nullable: true })
  @IsOptional()
  @IsEnum(OrderState)
  state?: OrderState;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsMongoId()
  roundsmanId?: string;
}
