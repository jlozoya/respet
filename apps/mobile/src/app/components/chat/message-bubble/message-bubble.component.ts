import { DatePipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonAvatar } from '@ionic/angular/ion-avatar';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Message } from '@respet/shared';

/** Mensaje con lo que la burbuja necesita saber para pintarse. */
export interface BubbleMessage {
  message: Message;
  /** Cierto si lo escribió el usuario actual: va a la derecha. */
  own: boolean;
  /** Primero de un bloque de mensajes seguidos del mismo autor. */
  startsGroup: boolean;
  /** Último del bloque. */
  endsGroup: boolean;
  showAvatar: boolean;
  showTime: boolean;
}

/**
 * Burbuja de un mensaje.
 *
 * Las esquinas se redondean según la posición dentro del bloque: la que da al
 * lado del autor se queda casi recta en los mensajes intermedios, que es el
 * detalle que hace que un grupo se lea como una sola pieza y no como tres
 * globos sueltos.
 */
@Component({
  selector: 'app-message-bubble',
  templateUrl: './message-bubble.component.html',
  styleUrls: ['./message-bubble.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, DatePipe, TranslatePipe, IonAvatar, IonIcon],
})
export class MessageBubbleComponent {
  readonly bubble = input.required<BubbleMessage>();

  readonly menuRequested = output<{ event: Event; message: Message }>();
  readonly imageOpened = output<Message>();

  readonly message = computed(() => this.bubble().message);
  readonly isImage = computed(
    () => this.message().kind === 'image' && this.message().media !== null,
  );

  readonly avatarUrl = computed(
    () => this.message().sender.avatar?.url ?? './assets/imgs/avatar.png',
  );

  /** Clases que fijan el redondeo según dónde caiga la burbuja en el bloque. */
  readonly shapeClasses = computed(() => {
    const { own, startsGroup, endsGroup } = this.bubble();

    return {
      'bubble--own': own,
      'bubble--peer': !own,
      'bubble--start': startsGroup,
      'bubble--end': endsGroup,
      'bubble--middle': !startsGroup && !endsGroup,
    };
  });

  onContextMenu(event: Event): void {
    event.preventDefault();
    this.menuRequested.emit({ event, message: this.message() });
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = './assets/imgs/avatar.png';
  }
}
