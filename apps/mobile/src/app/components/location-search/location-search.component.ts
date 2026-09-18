import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSearchbar } from '@ionic/angular/ion-searchbar';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ModalController } from '@ionic/angular/modal-controller';
import { TranslatePipe } from '@ngx-translate/core';
import type { LocationInput } from '@social-network/shared';

import { GoogleMapsService, type PlaceSuggestion } from '../../core/maps/google-maps.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { describeLocation } from '../../shared/location-text';

/**
 * Buscador de ubicaciones: se escribe dónde y se elige de una lista.
 *
 * El otro selector —`app-location-picker`— es un mapa con un marcador que se
 * arrastra, que sirve para fijar un domicilio o una bodega con precisión. Al
 * publicar algo, en cambio, nadie quiere arrastrar nada: quiere escribir
 * «Durango» y que le ofrezcan sitios. Por eso conviven los dos.
 *
 * Se devuelve al cerrarse: la ubicación elegida, `null` para quitar la que
 * hubiera, o nada si se sale sin tocar.
 */
@Component({
  selector: 'app-location-search',
  templateUrl: './location-search.component.html',
  styleUrls: ['./location-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonSearchbar,
    IonSpinner,
  ],
})
export class LocationSearchComponent {
  private readonly maps = inject(GoogleMapsService);
  private readonly feedback = inject(FeedbackService);
  private readonly modalCtrl = inject(ModalController);

  /** La que ya estaba puesta, para poder quitarla desde aquí. */
  readonly current = input<LocationInput | null>(null);

  readonly suggestions = signal<readonly PlaceSuggestion[]>([]);
  readonly searching = signal(false);
  /** Cierto cuando se ha buscado algo y no había nada que ofrecer. */
  readonly empty = signal(false);

  /** Cómo se lee la ubicación ya puesta. */
  readonly currentLabel = (location: LocationInput): string =>
    describeLocation(location) ?? '';

  async search(query: string): Promise<void> {
    if (!query.trim()) {
      this.suggestions.set([]);
      this.empty.set(false);

      return;
    }

    this.searching.set(true);

    try {
      const results = await this.maps.suggest(query);

      this.suggestions.set(results);
      this.empty.set(results.length === 0);
    } catch (error) {
      // Lo más probable es que falte la clave de Google o no haya red; en
      // cualquier caso, sin buscador no hay nada que enseñar.
      this.suggestions.set([]);
      await this.feedback.error(error, 'ERRORS.MAP');
    } finally {
      this.searching.set(false);
    }
  }

  /** Pide los datos del sitio elegido y cierra devolviéndolo. */
  async choose(suggestion: PlaceSuggestion): Promise<void> {
    this.searching.set(true);

    try {
      const location = await this.maps.place(suggestion.id);

      if (!location) {
        await this.feedback.toast('LOCATION.NOT_FOUND', { color: 'warning' });

        return;
      }

      await this.modalCtrl.dismiss(location, 'chosen');
    } catch (error) {
      await this.feedback.error(error, 'ERRORS.MAP');
    } finally {
      this.searching.set(false);
    }
  }

  /** Quita la ubicación que hubiera puesta. */
  remove(): void {
    void this.modalCtrl.dismiss(null, 'chosen');
  }

  dismiss(): void {
    void this.modalCtrl.dismiss(undefined, 'cancel');
  }
}
