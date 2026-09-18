import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { LocationInput } from '@social-network/shared';

import { GoogleMapsService } from '../../core/maps/google-maps.service';
import { FeedbackService } from '../../core/ui/feedback.service';

/**
 * Selector de ubicación sobre un mapa.
 *
 * Lo comparten el formulario de publicación, el de bodega, el de pedido y el
 * perfil del usuario: los cuatro repetían antes el mismo bloque de mapa,
 * marcador arrastrable y campos de dirección.
 *
 * El valor se expone con `model()`, de modo que el formulario que lo usa lee y
 * escribe la ubicación con un enlace de dos sentidos.
 */
@Component({
  selector: 'app-location-picker',
  templateUrl: './location-picker.component.html',
  styleUrls: ['./location-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, IonItem, IonInput, IonButton, IonIcon, IonSpinner],
})
export class LocationPickerComponent {
  private readonly maps = inject(GoogleMapsService);
  private readonly feedback = inject(FeedbackService);

  readonly location = model<LocationInput | null>(null);
  /** Muestra el mapa; con `false` sólo se ven los campos de dirección. */
  readonly showMap = input(true);

  /**
   * Si de verdad toca pintar mapa.
   *
   * Se pedía siempre que `showMap` fuera cierto, y sin clave configurada el
   * intento acababa en un aviso rojo —«no se pudo cargar el mapa»— cada vez
   * que alguien abría su dirección. No es un fallo suyo ni puede hacer nada
   * con él: sin clave, el formulario se queda en los campos, que funcionan.
   */
  readonly withMap = computed(() => this.showMap() && this.maps.isConfigured);

  private readonly canvas = viewChild<ElementRef<HTMLElement>>('mapCanvas');

  private map?: google.maps.Map;
  private marker?: google.maps.Marker;

  readonly loading = signal(false);
  readonly ready = signal(false);

  constructor() {
    afterNextRender(() => {
      if (this.withMap()) {
        void this.initMap();
      }
    });

    // Cuando la ubicación cambia desde fuera —al cargar una publicación para
    // editarla, por ejemplo— el marcador debe seguirla.
    effect(() => {
      const position = this.positionOf(this.location());

      if (position && this.map) {
        this.placeMarker(position, { center: true });
      }
    });
  }

  /** Actualiza un campo suelto de la dirección. */
  patch(field: keyof LocationInput, value: string): void {
    this.location.update((current) => ({ ...(current ?? {}), [field]: value || null }));
  }

  /** Busca en el mapa la dirección que se ha escrito. */
  async locateFromFields(): Promise<void> {
    const current = this.location();
    const query = [
      current?.streetNumber,
      current?.route,
      current?.city,
      current?.state,
      current?.country,
    ]
      .filter(Boolean)
      .join(', ');

    if (!query) {
      await this.feedback.toast('LOCATION.NOTHING_TO_SEARCH', { color: 'warning' });

      return;
    }

    this.loading.set(true);

    try {
      const position = await this.maps.geocode(query);

      if (!position) {
        await this.feedback.toast('LOCATION.NOT_FOUND', { color: 'warning' });

        return;
      }

      this.location.update((value) => ({ ...(value ?? {}), lat: position.lat, lng: position.lng }));
      this.placeMarker(position, { center: true });
    } catch (error) {
      await this.feedback.error(error, 'ERRORS.MAP');
    } finally {
      this.loading.set(false);
    }
  }

  /** Centra el mapa en la posición del dispositivo. */
  async useCurrentPosition(): Promise<void> {
    if (!navigator.geolocation) {
      await this.feedback.toast('LOCATION.UNSUPPORTED', { color: 'warning' });

      return;
    }

    this.loading.set(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void this.applyPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        this.loading.set(false);
      },
      () => {
        this.loading.set(false);
        void this.feedback.toast('LOCATION.DENIED', { color: 'warning' });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  clear(): void {
    this.location.set(null);
    this.marker?.setMap(null);
    this.marker = undefined;
  }

  private async initMap(): Promise<void> {
    const element = this.canvas()?.nativeElement;

    if (!element) {
      return;
    }

    try {
      const existing = this.positionOf(this.location());

      this.map = await this.maps.createMap({
        element,
        ...(existing ? { center: existing } : {}),
      });

      this.ready.set(true);

      if (existing) {
        this.placeMarker(existing, { center: false });
      }

      // Pulsar en el mapa fija la ubicación, que es la forma más rápida de
      // señalar un punto sin escribir la dirección entera.
      this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          void this.applyPosition({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        }
      });
    } catch (error) {
      await this.feedback.error(error, 'ERRORS.MAP');
    }
  }

  /** Fija una posición y rellena los campos con la dirección que le corresponde. */
  private async applyPosition(position: google.maps.LatLngLiteral): Promise<void> {
    this.placeMarker(position, { center: true });

    const resolved = await this.maps.reverseGeocode(position);

    this.location.update((current) => ({
      ...(current ?? {}),
      ...(resolved ?? {}),
      lat: position.lat,
      lng: position.lng,
    }));
  }

  private placeMarker(position: google.maps.LatLngLiteral, options: { center: boolean }): void {
    if (!this.map) {
      return;
    }

    if (this.marker) {
      this.marker.setPosition(position);
    } else {
      this.marker = new google.maps.Marker({ map: this.map, position, draggable: true });
      this.marker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          void this.applyPosition({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        }
      });
    }

    if (options.center) {
      this.map.setCenter(position);
    }
  }

  private positionOf(location: LocationInput | null): google.maps.LatLngLiteral | null {
    if (location?.lat == null || location.lng == null) {
      return null;
    }

    return { lat: location.lat, lng: location.lng };
  }
}
