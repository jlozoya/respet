import { ChangeDetectionStrategy, Component, input, signal, viewChild } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { IonLabel } from '@ionic/angular/ion-label';
import { TranslatePipe } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../shared/components/page-header.component';

/** Apartados legales que muestra la página. */
const SECTIONS = ['end_user_agreement', 'privacy', 'cookies'] as const;

type Section = (typeof SECTIONS)[number];

@Component({
  selector: 'app-politics',
  templateUrl: 'politics.page.html',
  styleUrls: ['politics.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeaderComponent, IonContent, IonSegment, IonSegmentButton, IonLabel],
})
export class PoliticsPage {
  /** Apartado inicial, tomado del parámetro `:segment` de la ruta. */
  readonly segment = input<string>('end_user_agreement');

  private readonly content = viewChild.required(IonContent);

  readonly sections = SECTIONS;
  readonly current = signal<Section>('end_user_agreement');

  constructor() {
    const initial = this.segment();

    if (isSection(initial)) {
      this.current.set(initial);
    }
  }

  changeTo(section: string): void {
    if (!isSection(section)) {
      return;
    }

    this.current.set(section);
    // Cambiar de apartado sin volver arriba dejaría al lector a media altura
    // de un texto que ya no es el que estaba leyendo.
    void this.content().scrollToTop(300);
  }
}

function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}
