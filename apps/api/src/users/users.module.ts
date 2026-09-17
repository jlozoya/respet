import { Module } from '@nestjs/common';

import { AccountCleanup } from './account-cleanup.service.js';
import { UsersResolver } from './users.resolver.js';
import { UsersService } from './users.service.js';

@Module({
  providers: [UsersResolver, UsersService, AccountCleanup],
  exports: [UsersService],
})
export class UsersModule {}
