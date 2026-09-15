import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { UsersController } from './users.controller.js';
import { UsersResolver } from './users.resolver.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersResolver, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
