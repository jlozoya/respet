import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { Conversation } from '@social-network/shared';

import { AuthService } from '../../core/auth/auth.service';
import { PresenceService } from '../../core/realtime/presence.service';
import { AvatarComponent } from '../../shared/components/avatar.component';

/**
 * La cara de una conversación.
 *
 * En las de dos, la foto de la otra persona con su punto de conectada; en los
 * grupos, la foto del grupo o, si no tiene, dos avatares superpuestos como en
 * Messenger.
 */
@Component({
  selector: 'app-conversation-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent],
  host: { '[style.--size.px]': 'size()' },
  template: `
    @let item = conversation();
    @if (item.type === 'direct') {
      <app-avatar [user]="item.peer" [size]="size()" [online]="online()" />
    } @else if (item.photo) {
      <app-avatar [src]="item.photo.url" [label]="item.title" [size]="size()" />
    } @else {
      <span class="stack">
        <app-avatar class="back" [user]="others()[0]" [size]="size() * 0.68" />
        <app-avatar class="front" [user]="second()" [size]="size() * 0.68" />
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: 0 0 auto;
    }

    .stack {
      display: block;
      height: var(--size);
      position: relative;
      width: var(--size);
    }

    .back {
      left: 0;
      position: absolute;
      top: 0;
    }

    .front {
      border: 2px solid var(--rs-surface);
      border-radius: 50%;
      bottom: 0;
      position: absolute;
      right: 0;
    }
  `,
})
export class ConversationAvatarComponent {
  private readonly auth = inject(AuthService);
  private readonly presence = inject(PresenceService);

  readonly conversation = input.required<Conversation>();
  readonly size = input(48);

  readonly others = computed(() =>
    this.conversation()
      .members.map((member) => member.user)
      .filter((user) => user.id !== this.auth.user()?.id),
  );

  /** El segundo avatar de la pila; con un solo miembro se repite el primero. */
  readonly second = computed(() => {
    const others = this.others();

    return others.length > 1 ? others[1] : others[0];
  });

  readonly online = computed(() => {
    const peer = this.conversation().peer;

    return peer ? this.presence.isOnline(peer.id)() : false;
  });
}

/** El nombre de una conversación: el del grupo, o el de la otra persona. */
export function conversationTitle(conversation: Conversation, meId: string | undefined): string {
  if (conversation.type === 'direct') {
    const peer = conversation.peer;

    return peer ? [peer.firstName, peer.lastName].filter(Boolean).join(' ') || peer.name : '';
  }

  if (conversation.title) {
    return conversation.title;
  }

  return conversation.members
    .filter((member) => member.user.id !== meId)
    .map((member) => member.user.firstName || member.user.name)
    .join(', ');
}
