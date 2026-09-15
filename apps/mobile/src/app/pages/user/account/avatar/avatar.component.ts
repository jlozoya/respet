import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Media, User } from '@respet/shared';

import { UsersService } from '../../../../core/api/users.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { ImagePickerService } from '../../../../core/media/image-picker.service';
import { FeedbackService } from '../../../../core/ui/feedback.service';

const FALLBACK = './assets/imgs/avatar.png';

/** Foto de perfil, con la acción de cambiarla si la cuenta es propia. */
@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonButton, IonIcon],
})
export class AvatarComponent {
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly picker = inject(ImagePickerService);
  private readonly feedback = inject(FeedbackService);

  readonly user = input.required<User>();
  readonly editable = input(true);

  readonly changed = output<Media>();

  readonly uploading = signal(false);
  private readonly localPreview = signal<string | null>(null);

  readonly imageUrl = computed(() => this.localPreview() ?? this.user().avatar?.url ?? FALLBACK);

  async change(): Promise<void> {
    const blob = await this.picker.pick({ aspectRatio: 1, targetWidth: 512 });

    if (!blob) {
      return;
    }

    this.uploading.set(true);
    // La vista previa aparece de inmediato; la subida puede tardar y no
    // conviene dejar la foto anterior mientras tanto.
    this.localPreview.set(URL.createObjectURL(blob));

    try {
      const media = await this.users.updateAvatar(blob, 'avatar.webp');

      // El usuario en sesión guarda su avatar, así que hay que refrescarlo
      // para que el menú lateral enseñe la foto nueva.
      await this.auth.refreshUser();
      this.changed.emit(media);
    } catch (error) {
      this.localPreview.set(null);
      await this.feedback.error(error);
    } finally {
      this.uploading.set(false);
    }
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = FALLBACK;
  }
}
