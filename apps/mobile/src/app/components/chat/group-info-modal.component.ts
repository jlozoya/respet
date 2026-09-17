import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController } from '@ionic/angular/action-sheet-controller';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { ConversationMember, Message } from '@respet/shared';

import { ChatService } from '../../core/api/chat.service';
import { SocialService } from '../../core/api/social.service';
import { AuthService } from '../../core/auth/auth.service';
import { ImagePickerService } from '../../core/media/image-picker.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ReportService } from '../../core/ui/report.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { FullNamePipe } from '../../shared/pipes/full-name.pipe';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { ConversationAvatarComponent, conversationTitle } from './conversation-avatar.component';
import { NewConversationModalComponent } from './new-conversation-modal.component';

/**
 * Los detalles de una conversación: la columna de la derecha de Messenger.
 *
 * Silenciar, buscar en el hilo, ver y gestionar a los participantes de un
 * grupo —añadir, quitar, hacer administrador—, cambiarle el nombre y la foto,
 * salir, bloquear o denunciar.
 */
@Component({
  selector: 'app-group-info-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    AvatarComponent,
    ConversationAvatarComponent,
    FullNamePipe,
    RelativeTimePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonToggle,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ 'MESSENGER.INFO' | translate }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()"><ion-icon slot="icon-only" name="close" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (conversation(); as item) {
        <div class="hero">
          <app-conversation-avatar [conversation]="item" [size]="80" />
          <h2>{{ title() }}</h2>
          @if (item.type === 'group' && isAdmin()) {
            <div class="hero-actions">
              <ion-button size="small" class="rs-soft" (click)="rename()">
                <ion-icon slot="start" name="create-outline" /> {{ 'MESSENGER.RENAME' | translate }}
              </ion-button>
              <ion-button size="small" class="rs-soft" (click)="changePhoto()">
                <ion-icon slot="start" name="camera-outline" /> {{ 'MESSENGER.CHANGE_PHOTO' | translate }}
              </ion-button>
            </div>
          }
          @if (item.peer; as peer) {
            <ion-button size="small" class="rs-soft" (click)="openProfile(peer.name)">
              <ion-icon slot="start" name="person-circle-outline" /> {{ 'MESSENGER.VIEW_PROFILE' | translate }}
            </ion-button>
          }
        </div>

        <div class="section">
          <div class="rs-row">
            <span class="rs-row-icon"><ion-icon name="notifications-off-outline" /></span>
            <span class="rs-row-text"><span class="title">{{ 'MESSENGER.MUTE' | translate }}</span></span>
            <ion-toggle [checked]="item.muted" (ionChange)="setMuted($event.detail.checked)" [attr.aria-label]="'MESSENGER.MUTE' | translate" />
          </div>
          <label class="rs-pill-input search">
            <ion-icon name="search" />
            <input type="search" [placeholder]="'MESSENGER.SEARCH_IN_CHAT' | translate" (keydown.enter)="search($any($event.target).value)" />
          </label>
          @for (hit of hits(); track hit.id) {
            <div class="hit">
              <span class="rs-strong rs-small">{{ hit.sender | fullName }} · {{ hit.createdAt | relativeTime }}</span>
              <span class="rs-small">{{ hit.body }}</span>
            </div>
          }
        </div>

        @if (item.type === 'group') {
          <div class="section">
            <h3 class="rs-section-title">{{ 'MESSENGER.MEMBERS' | translate: { count: item.members.length } }}</h3>
            @if (isAdmin()) {
              <button type="button" class="rs-row" (click)="addMembers()">
                <span class="rs-row-icon"><ion-icon name="person-add" /></span>
                <span class="rs-row-text"><span class="title">{{ 'MESSENGER.ADD_PEOPLE' | translate }}</span></span>
              </button>
            }
            @for (member of item.members; track member.user.id) {
              <div class="rs-row">
                <app-avatar [user]="member.user" [size]="40" />
                <span class="rs-row-text">
                  <span class="title">{{ member.user | fullName }}</span>
                  <span class="subtitle">{{ roleLabel(member) | translate }}</span>
                </span>
                @if (isAdmin() && member.user.id !== meId() && member.role !== 'owner') {
                  <button type="button" class="rs-icon-btn plain" (click)="memberMenu(member)" [attr.aria-label]="'COMMON.OPTIONS' | translate">
                    <ion-icon name="ellipsis-horizontal" />
                  </button>
                }
              </div>
            }
          </div>
        }

        <div class="section">
          <button type="button" class="rs-row" (click)="clear()">
            <span class="rs-row-icon"><ion-icon name="trash-outline" /></span>
            <span class="rs-row-text"><span class="title">{{ 'MESSENGER.DELETE_CHAT' | translate }}</span></span>
          </button>
          @if (item.type === 'group') {
            <button type="button" class="rs-row danger" (click)="leave()">
              <span class="rs-row-icon"><ion-icon name="exit-outline" /></span>
              <span class="rs-row-text"><span class="title">{{ 'MESSENGER.LEAVE_GROUP' | translate }}</span></span>
            </button>
          } @else if (item.peer; as peer) {
            <button type="button" class="rs-row danger" (click)="block(peer.id)">
              <span class="rs-row-icon"><ion-icon name="ban-outline" /></span>
              <span class="rs-row-text"><span class="title">{{ 'PROFILE.BLOCK' | translate }}</span></span>
            </button>
            <button type="button" class="rs-row danger" (click)="reportUser(peer.id)">
              <span class="rs-row-icon"><ion-icon name="flag-outline" /></span>
              <span class="rs-row-text"><span class="title">{{ 'REPORT' | translate }}</span></span>
            </button>
          }
        </div>
      }
    </ion-content>
  `,
  styles: `
    .hero {
      align-items: center;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 24px 16px 12px;
      text-align: center;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .section {
      border-top: 1px solid var(--rs-divider);
      padding: 8px;
    }

    .search {
      margin: 8px;
    }

    .hit {
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      padding: 6px 12px;
    }

    .danger {
      color: var(--ion-color-danger);
    }
  `,
})
export class GroupInfoModalComponent {
  private readonly chat = inject(ChatService);
  private readonly social = inject(SocialService);
  private readonly auth = inject(AuthService);
  private readonly images = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);
  private readonly reports = inject(ReportService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly conversationId = input.required<string>();

  readonly hits = signal<Message[]>([]);

  readonly conversation = computed(() => this.chat.conversation(this.conversationId())());
  readonly meId = computed(() => this.auth.user()?.id);
  readonly isAdmin = computed(() => {
    const role = this.conversation()?.myRole;

    return role === 'owner' || role === 'admin';
  });
  readonly title = computed(() => {
    const item = this.conversation();

    return item ? conversationTitle(item, this.meId()) : '';
  });

  roleLabel(member: ConversationMember): string {
    return `MESSENGER.ROLES.${member.role.toUpperCase()}`;
  }

  close(result?: string): void {
    void this.modalCtrl.dismiss(result);
  }

  async openProfile(name: string): Promise<void> {
    this.close();
    await this.router.navigate(['/profile', name]);
  }

  async setMuted(muted: boolean): Promise<void> {
    await this.guard(() => this.chat.setMuted(this.conversationId(), muted));
  }

  async search(term: string): Promise<void> {
    if (term.trim().length < 2) {
      this.hits.set([]);

      return;
    }

    await this.guard(async () => this.hits.set(await this.chat.search(this.conversationId(), term.trim())));
  }

  async rename(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('MESSENGER.RENAME'),
      inputs: [{ name: 'title', value: this.conversation()?.title ?? '', attributes: { maxlength: 80 } }],
      buttons: [
        { text: this.t('CANCEL'), role: 'cancel' },
        { text: this.t('SAVE'), role: 'confirm' },
      ],
    });

    await alert.present();
    const { data, role } = await alert.onWillDismiss<{ values: { title?: string } }>();
    const title = data?.values.title?.trim();

    if (role === 'confirm' && title) {
      await this.guard(() => this.chat.rename(this.conversationId(), title));
    }
  }

  async changePhoto(): Promise<void> {
    const file = await this.images.pick({ aspectRatio: 1, targetWidth: 512 });

    if (file) {
      await this.guard(() => this.chat.setPhoto(this.conversationId(), file));
    }
  }

  async addMembers(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: NewConversationModalComponent,
      componentProps: { pickOnly: true },
      cssClass: 'rs-dialog',
    });

    await modal.present();
    const { data } = await modal.onWillDismiss<string[]>();

    if (Array.isArray(data) && data.length) {
      await this.guard(() => this.chat.addMembers(this.conversationId(), data));
    }
  }

  async memberMenu(member: ConversationMember): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      buttons: [
        {
          text: this.t(member.role === 'admin' ? 'MESSENGER.REMOVE_ADMIN' : 'MESSENGER.MAKE_ADMIN'),
          icon: 'shield-outline',
          data: 'admin',
        },
        { text: this.t('MESSENGER.REMOVE_MEMBER'), icon: 'person-remove-outline', role: 'destructive', data: 'remove' },
        { text: this.t('CANCEL'), role: 'cancel' },
      ],
    });

    await sheet.present();
    const { data } = await sheet.onWillDismiss<string>();

    if (data === 'admin') {
      await this.guard(() => this.chat.setAdmin(this.conversationId(), member.user.id, member.role !== 'admin'));
    } else if (data === 'remove') {
      await this.guard(() => this.chat.removeMember(this.conversationId(), member.user.id));
    }
  }

  async clear(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'MESSENGER.DELETE_CHAT',
      message: 'MESSENGER.DELETE_CHAT_MESSAGE',
      confirmText: 'DELETE',
      danger: true,
    });

    if (confirmed) {
      await this.guard(() => this.chat.clear(this.conversationId()));
      this.close('cleared');
    }
  }

  async leave(): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'MESSENGER.LEAVE_GROUP',
      message: 'MESSENGER.LEAVE_GROUP_MESSAGE',
      confirmText: 'MESSENGER.LEAVE',
      danger: true,
    });

    if (confirmed) {
      await this.guard(() => this.chat.leave(this.conversationId()));
      this.close('left');
    }
  }

  async block(userId: string): Promise<void> {
    const confirmed = await this.feedback.confirm({
      header: 'PROFILE.BLOCK',
      message: 'PROFILE.BLOCK_MESSAGE',
      confirmText: 'PROFILE.BLOCK',
      danger: true,
    });

    if (confirmed) {
      await this.guard(() => this.social.block(userId));
      await this.feedback.toast('PROFILE.BLOCKED', { color: 'success' });
    }
  }

  async reportUser(userId: string): Promise<void> {
    await this.reports.report('user', userId);
  }

  private async guard(operation: () => Promise<unknown>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private t(key: string): string {
    return this.translate.instant(key) as string;
  }
}
