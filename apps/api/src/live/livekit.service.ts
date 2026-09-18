import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

import { AppException, ErrorCode } from '../common/errors.js';

export interface LiveKitIdentity {
  id: string;
  name: string;
}

/**
 * El servidor de vídeo de los directos.
 *
 * La API no mueve ni un fotograma: quien emite y quien mira se conectan a
 * LiveKit, un servidor WebRTC que se despliega junto a la API. Aquí sólo se
 * crean y cierran salas y se firman los pases para entrar en ellas —con
 * permiso para emitir quien retransmite, sólo para mirar el resto—.
 */
@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name);
  private readonly rooms?: RoomServiceClient;

  constructor(private readonly config: ConfigService) {
    const { apiUrl, apiKey, apiSecret } = this.settings();

    if (apiUrl && apiKey && apiSecret) {
      this.rooms = new RoomServiceClient(apiUrl, apiKey, apiSecret);
    }
  }

  get enabled(): boolean {
    return this.rooms !== undefined && Boolean(this.settings().url);
  }

  get serverUrl(): string {
    return this.settings().url ?? '';
  }

  assertEnabled(): void {
    if (!this.enabled) {
      throw new AppException(
        ErrorCode.LiveNotConfigured,
        HttpStatus.NOT_IMPLEMENTED,
        'Live streaming is not configured on this server',
      );
    }
  }

  async createRoom(name: string): Promise<void> {
    this.assertEnabled();

    await this.rooms?.createRoom({
      name,
      // La sala aguanta un rato vacía para que quien emite pueda reconectar
      // tras un corte sin perder el directo.
      emptyTimeout: 120,
      departureTimeout: 60,
      maxParticipants: 5000,
    });
  }

  async deleteRoom(name: string): Promise<void> {
    try {
      await this.rooms?.deleteRoom(name);
    } catch (error) {
      this.logger.debug(`La sala ${name} ya no existía: ${String(error)}`);
    }
  }

  /** Cuántos miran ahora, sin contar a quien emite. */
  async viewerCount(room: string, hostIdentity: string): Promise<number | null> {
    try {
      const participants = (await this.rooms?.listParticipants(room)) ?? [];

      return participants.filter((participant) => participant.identity !== hostIdentity).length;
    } catch {
      return null;
    }
  }

  async hostToken(room: string, identity: LiveKitIdentity): Promise<string> {
    return this.token(room, identity, { canPublish: true, canSubscribe: true, canPublishData: true }, '6h');
  }

  async viewerToken(room: string, identity: LiveKitIdentity): Promise<string> {
    // Los comentarios y reacciones van por la API, no por el canal de datos de
    // LiveKit: así pasan por los bloqueos y los límites como todo lo demás.
    return this.token(room, identity, { canPublish: false, canSubscribe: true, canPublishData: false }, '4h');
  }

  private async token(
    room: string,
    identity: LiveKitIdentity,
    grants: { canPublish: boolean; canSubscribe: boolean; canPublishData: boolean },
    ttl: string,
  ): Promise<string> {
    this.assertEnabled();

    const { apiKey, apiSecret } = this.settings();
    const token = new AccessToken(apiKey, apiSecret, { identity: identity.id, name: identity.name, ttl });

    token.addGrant({ room, roomJoin: true, ...grants });

    return token.toJwt();
  }

  private settings(): { url?: string; apiUrl?: string; apiKey?: string; apiSecret?: string } {
    return this.config.get('livekit') ?? {};
  }
}
