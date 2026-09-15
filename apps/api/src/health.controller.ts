import { Controller, Get } from '@nestjs/common';

import { Public } from './common/decorators/index.js';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from './database/mongoose.js';

interface HealthReport {
  status: 'ok' | 'degraded';
  uptime: number;
  database: 'up' | 'down';
  timestamp: string;
}

/** Comprobación de estado, para el balanceador o el monitor. */
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  async check(): Promise<HealthReport> {
    const database = await this.pingDatabase();

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      database,
      timestamp: new Date().toISOString(),
    };
  }

  private async pingDatabase(): Promise<'up' | 'down'> {
    try {
      // Una orden barata que sólo responde si la conexión está viva.
      await this.connection.db?.admin().ping();

      return 'up';
    } catch {
      return 'down';
    }
  }
}
