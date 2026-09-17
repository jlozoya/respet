import { ChangeDetectionStrategy, Component, type OnInit, computed, inject, input, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFooter } from '@ionic/angular/ion-footer';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { UserSummary } from '@respet/shared';

import { ChatService } from '../../core/api/chat.service';
import { SocialService } from '../../core/api/social.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';

/**
 * «Nuevo mensaje»: a quién escribir.
 *
 * Una persona abre —o recupera— la conversación con ella; varias crean un
 * grupo, para el que se pide un nombre. Sin escribir nada propone los
 * contactos, con los conectados primero.
 */
@Component({
  selector: 'app-new-conversation-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    AvatarComponent,
    FullNamePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonFooter,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ (pickOnly() ? 'MESSENGER.ADD_PEOPLE' : 'MESSENGER.NEW') | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()"><ion-icon slot="icon-only" name="close" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="to">
        <span class="rs-muted">{{ 'MESSENGER.TO' | translate }}</span>
        @for (user of chosen(); track user.id) {
          <button type="button" class="rs-chip active" (click)="toggle(user)">
            {{ user | fullName }} <ion-icon name="close" />
          </button>
        }
        <input
          type="search"
          [value]="term()"
          (input)="search($any($event.target).value)"
          [placeholder]="'MESSENGER.SEARCH_PEOPLE' | translate"
        />
      </div>

      @if (chosen().length > 1 && !pickOnly()) {
        <label class="rs-pill-input group-name">
          <ion-icon name="people" />
          <input type="text" maxlength="80" [value]="title()" (input)="title.set($any($event.target).value)" [placeholder]="'MESSENGER.GROUP_NAME' | translate" />
        </label>
      }

      <h3 class="rs-section-title">{{ (term() ? 'MESSENGER.RESULTS' : 'MESSENGER.SUGGESTED') | translate }}</h3>

      <div class="list">
        @if (loading()) {
          <div class="rs-empty"><ion-spinner /></div>
        }
        @for (user of candidates(); track user.id) {
          <button type="button" class="rs-row" (click)="toggle(user)">
            <app-avatar [user]="user" [size]="40" />
            <span class="rs-row-text">
              <span class="title">{{ user | fullName }}</span>
              <span class="subtitle">&#64;{{ user.name }}</span>
            </span>
            <span class="check" [class.on]="isChosen(user)">
              @if (isChosen(user)) {
                <ion-icon name="checkmark" />
              }
            </span>
          </button>
        }
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" class="start" [disabled]="!canStart() || busy()" (click)="start()">
          {{ (pickOnly() ? 'ADD' : chosen().length > 1 ? 'MESSENGER.CREATE_GROUP' : 'MESSENGER.START_CHAT') | translate }}
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: `
    .to {
      align-items: center;
      border-bottom: 1px solid var(--rs-divider);
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 12px 16px;
    }

    .to input {
      background: transparent;
      border: 0;
      color: inherit;
      flex: 1 1 120px;
      font-size: 1rem;
      outline: none;
    }

    .group-name {
      margin: 12px 16px 0;
    }

    .list {
      padding: 0 8px 8px;
    }

    .check {
      align-items: center;
      border: 2px solid var(--rs-divider);
      border-radius: 50%;
      color: #fff;
      display: flex;
      height: 22px;
      justify-content: center;
      width: 22px;
    }

    .check.on {
      background: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }

    .start {
      margin: 0 12px;
    }
  `,
})
export class NewConversationModalComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly social = inject(SocialService);
  private readonly chat = inject(ChatService);
  private readonly feedback = inject(FeedbackService);

  /** Sólo elegir personas, para añadirlas a un grupo: devuelve sus ids. */
  readonly pickOnly = input(false);

  readonly term = signal('');
  readonly title = signal('');
  readonly results = signal<UserSummary[]>([]);
  readonly suggestions = signal<UserSummary[]>([]);
  readonly chosen = signal<UserSummary[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);

  readonly candidates = computed(() => (this.term().trim() ? this.results() : this.suggestions()));
  readonly canStart = computed(
    () =>
      (this.pickOnly() && this.chosen().length > 0) ||
      this.chosen().length === 1 ||
      (this.chosen().length > 1 && this.title().trim().length > 0),
  );

  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    this.loading.set(true);

    try {
      const contacts = await this.social.onlineContacts();
      this.suggestions.set(contacts.map((contact) => contact.user));
    } catch {
      // Sin sugerencias queda el buscador.
    } finally {
      this.loading.set(false);
    }
  }

  search(value: string): void {
    this.term.set(value);

    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (value.trim().length < 2) {
      this.results.set([]);

      return;
    }

    this.timer = setTimeout(async () => {
      this.loading.set(true);

      try {
        const { users } = await this.social.quickSearch(value.trim(), 15);
        this.results.set(users);
      } finally {
        this.loading.set(false);
      }
    }, 250);
  }

  isChosen(user: UserSummary): boolean {
    return this.chosen().some((item) => item.id === user.id);
  }

  toggle(user: UserSummary): void {
    this.chosen.update((current) =>
      current.some((item) => item.id === user.id) ? current.filter((item) => item.id !== user.id) : [...current, user],
    );
  }

  async start(): Promise<void> {
    const chosen = this.chosen();

    if (this.pickOnly()) {
      await this.modalCtrl.dismiss(chosen.map((user) => user.id));

      return;
    }

    this.busy.set(true);

    try {
      const conversation =
        chosen.length === 1 && chosen[0]
          ? await this.chat.startConversationWith(chosen[0].id)
          : await this.chat.createGroup(
              this.title().trim(),
              chosen.map((user) => user.id),
            );

      await this.modalCtrl.dismiss(conversation);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.busy.set(false);
    }
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }
}
