import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterNextRender,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { TranslatePipe } from '@ngx-translate/core';
import type { Media } from '@respet/shared';

/**
 * Carrusel de imágenes a pantalla completa.
 *
 * Es un contenedor con `scroll-snap` en lugar de `<ion-slides>`, que Ionic
 * retiró en la versión 7. Así se evita también la dependencia de Swiper, que es
 * lo que la documentación propone como sustituto: para pasar imágenes con el
 * dedo basta el desplazamiento nativo del navegador, que además se comporta
 * mejor con los lectores de pantalla.
 *
 * Vive aparte de quien lo enseña porque lo usan dos ventanas distintas: el
 * visor suelto de una galería y el detalle de una publicación.
 */
@Component({
  selector: 'app-carousel',
  templateUrl: './carousel.component.html',
  styleUrls: ['./carousel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonButton, IonIcon],
})
export class CarouselComponent {
  readonly images = input<readonly Media[]>([]);
  readonly startIndex = input(0);

  /** Qué imagen se está viendo, para que la cabecera de arriba lo cuente. */
  readonly indexChanged = output<number>();

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  /** Índice visible, para el indicador de posición. */
  readonly currentIndex = signal(0);

  constructor() {
    afterNextRender(() => {
      this.setIndex(this.startIndex());
      this.scrollTo(this.startIndex());
    });
  }

  /** Mantiene el indicador al día mientras se desplaza el carrusel. */
  onScroll(): void {
    const element = this.track()?.nativeElement;

    if (!element || element.clientWidth === 0) {
      return;
    }

    this.setIndex(Math.round(element.scrollLeft / element.clientWidth));
  }

  /** Salta a una imagen concreta; el indicador lo actualiza el propio scroll. */
  goTo(index: number): void {
    const element = this.track()?.nativeElement;

    if (!element) {
      return;
    }

    const target = Math.min(Math.max(index, 0), this.images().length - 1);

    element.scrollTo({ left: target * element.clientWidth, behavior: 'smooth' });
  }

  onKeydown(event: KeyboardEvent): void {
    const paso = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (paso === 0) {
      return;
    }

    // El desplazamiento propio del navegador movería píxeles sueltos; aquí
    // interesa saltar de imagen completa.
    event.preventDefault();
    this.goTo(this.currentIndex() + paso);
  }

  private setIndex(index: number): void {
    if (this.currentIndex() === index) {
      return;
    }

    this.currentIndex.set(index);
    this.indexChanged.emit(index);
  }

  private scrollTo(index: number): void {
    const element = this.track()?.nativeElement;

    // `instant` en la apertura: una animación desde la primera imagen hasta la
    // pulsada se vería como un barrido brusco de todo el carrusel.
    element?.scrollTo({ left: index * element.clientWidth, behavior: 'instant' });
  }
}
