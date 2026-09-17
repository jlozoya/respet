import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import type { OnlineContact, PresencePayload } from '@respet/shared';
import type { Subscription } from 'rxjs';

import { SocialService } from '../api/social.service';

interface PresenceState {
  online: boolean;
  lastSeenAt: string | null;
}

/**
 * Quién está conectado.
 *
 * Arranca con la lista de contactos —las personas que se siguen, con su
 * estado— y se mantiene al día escuchando `presenceChanged` para esas personas
 * y para las que se vayan añadiendo: las del chat, un perfil que se visita.
 * Quien no comparte su estado nunca aparece conectado; eso lo decide el
 * servidor.
 */
@Injectable({ providedIn: 'root' })
export class PresenceService {
  private readonly social = inject(SocialService);

  private readonly stateSignal = signal<ReadonlyMap<string, PresenceState>>(new Map());
  private readonly contactsSignal = signal<OnlineContact[]>([]);
  private readonly tracked = new Set<string>();
  private subscription: Subscription | null = null;
  private resubscribeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Los contactos, primero los conectados. */
  readonly contacts = computed(() => {
    const state = this.stateSignal();

    return this.contactsSignal()
      .map((contact) => ({ ...contact, ...(state.get(contact.user.id) ?? {}) }))
      .sort((a, b) => Number(b.online) - Number(a.online));
  });

  async start(): Promise<void> {
    try {
      const contacts = await this.social.onlineContacts();
      this.contactsSignal.set(contacts);
      this.stateSignal.update((current) => {
        const next = new Map(current);

        for (const contact of contacts) {
          next.set(contact.user.id, { online: contact.online, lastSeenAt: contact.lastSeenAt });
        }

        return next;
      });
      this.track(contacts.map((contact) => contact.user.id));
    } catch {
      // Sin contactos la columna queda vacía; no es motivo para avisar.
    }
  }

  stop(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.tracked.clear();
    this.contactsSignal.set([]);
    this.stateSignal.set(new Map());
  }

  /** Empieza a vigilar a estas personas, además de las que ya se vigilaban. */
  track(userIds: readonly string[]): void {
    const before = this.tracked.size;

    for (const id of userIds) {
      this.tracked.add(id);
    }

    if (this.tracked.size === before && this.subscription) {
      return;
    }

    // Varias pantallas piden a la vez al abrirse: se agrupan en una sola
    // suscripción en lugar de rehacerla por cada una.
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
    }

    this.resubscribeTimer = setTimeout(() => this.resubscribe(), 300);
  }

  /** Apunta un estado conocido por otra vía, como la ficha de un perfil. */
  set(userId: string, online: boolean | null, lastSeenAt: string | null): void {
    if (online === null) {
      return;
    }

    this.apply({ userId, online, lastSeenAt });
  }

  isOnline(userId: string | null | undefined): Signal<boolean> {
    return computed(() => (userId ? (this.stateSignal().get(userId)?.online ?? false) : false));
  }

  lastSeen(userId: string | null | undefined): Signal<string | null> {
    return computed(() => (userId ? (this.stateSignal().get(userId)?.lastSeenAt ?? null) : null));
  }

  private resubscribe(): void {
    this.subscription?.unsubscribe();

    if (this.tracked.size === 0) {
      this.subscription = null;

      return;
    }

    this.subscription = this.social.presence([...this.tracked].slice(0, 500)).subscribe({
      next: ({ presenceChanged }) => this.apply(presenceChanged),
      error: () => {
        this.subscription = null;
      },
    });
  }

  private apply(change: PresencePayload): void {
    this.stateSignal.update((current) => {
      const next = new Map(current);
      next.set(change.userId, { online: change.online, lastSeenAt: change.lastSeenAt });

      return next;
    });
  }
}
