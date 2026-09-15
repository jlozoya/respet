import { ChangeDetectionStrategy, Component, type ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { TranslatePipe } from '@ngx-translate/core';

import { GoogleMapsService } from '../../core/maps/google-maps.service';
import { FooterComponent } from '../../components/footer/footer.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/** Dónde estamos. */
const OFFICE = {
  name: 'Respet',
  position: { lat: 24.0306214, lng: -104.6700796 },
  address: ['Victoria 343', '34000 Durango, Durango', 'México'],
};

@Component({
  selector: 'app-about',
  templateUrl: 'about.page.html',
  styleUrls: ['about.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeaderComponent, FooterComponent, IonContent],
})
export class AboutPage {
  private readonly maps = inject(GoogleMapsService);

  private readonly canvas = viewChild<ElementRef<HTMLElement>>('mapCanvas');

  readonly office = OFFICE;

  constructor() {
    afterNextRender(() => void this.renderMap());
  }

  private async renderMap(): Promise<void> {
    const element = this.canvas()?.nativeElement;

    if (!element) {
      return;
    }

    try {
      const map = await this.maps.createMap({ element, center: OFFICE.position });

      await this.maps.addMarker({
        map,
        position: OFFICE.position,
        title: OFFICE.name,
        content: `<div class="map-info"><h6>${OFFICE.name}</h6>${OFFICE.address
          .map((line) => `<p>${line}</p>`)
          .join('')}</div>`,
      });
    } catch {
      // Sin mapa la página sigue siendo útil: la dirección está escrita al lado.
    }
  }
}
