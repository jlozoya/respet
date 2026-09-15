import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { Media, PublicProfile, UserContact } from '@respet/shared';

import { ImgModalComponent } from '../../gallery/img-modal/img-modal.component';
import { describeLocation } from '../../../shared/location-text';

/**
 * La columna de la izquierda del perfil: quién es y qué ha enseñado.
 *
 * Reúne lo poco que se sabe de una persona sin preguntarle nada —dónde vive,
 * desde cuándo está, cómo dejarle un recado— y las fotos que ha ido
 * publicando, que es lo que de verdad cuenta quién es. Lo que no comparte
 * sencillamente no aparece: una ficha con huecos rotulados «sin datos» dice
 * menos que una ficha corta.
 */
@Component({
  selector: 'app-profile-about',
  templateUrl: './profile-about.component.html',
  styleUrls: ['./profile-about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TranslatePipe, IonIcon],
})
export class ProfileAboutComponent {
  private readonly modalCtrl = inject(ModalController);

  readonly profile = input.required<PublicProfile>();
  readonly contact = input<UserContact | null>(null);
  readonly photos = input<readonly Media[]>([]);

  /** Dónde vive, si lo comparte. */
  readonly place = computed(() => {
    const location = this.contact()?.location;

    return location ? describeLocation(location, true) : null;
  });

  readonly emails = computed(() => {
    const value = this.contact();

    if (!value) {
      return [];
    }

    return [...(value.email ? [value.email] : []), ...value.emails.map((item) => item.email)];
  });

  readonly phones = computed(() => {
    const value = this.contact();

    if (!value) {
      return [];
    }

    return [...(value.phone ? [value.phone] : []), ...value.phones.map((item) => item.phone)];
  });

  /** Cierto cuando hay algo que contar; si no, la tarjeta no se pinta. */
  readonly hasDetails = computed(
    () => this.place() !== null || this.emails().length > 0 || this.phones().length > 0,
  );

  async openPhoto(photo: Media): Promise<void> {
    const images = this.photos();
    const modal = await this.modalCtrl.create({
      component: ImgModalComponent,
      componentProps: { images, startIndex: Math.max(0, images.indexOf(photo)) },
    });

    await modal.present();
  }

  mailTo(email: string): void {
    window.location.href = `mailto:${email}`;
  }

  callTo(phone: string): void {
    window.location.href = `tel:${phone}`;
  }
}
