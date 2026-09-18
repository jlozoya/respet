import { Injectable } from '@angular/core';
import type { LocationInput } from '@social-network/shared';

import { environment } from '../../../environments/environment';
import { MapStyle } from './map-style';

/** Centro por defecto: Durango, México. */
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 24.02, lng: -104.658 };

export interface MapOptions {
  element: HTMLElement;
  center?: google.maps.LatLngLiteral;
  zoom?: number;
}

export interface MarkerOptions {
  map: google.maps.Map;
  position: google.maps.LatLngLiteral;
  title?: string;
  /** HTML de la ventana que se abre al pulsar el marcador. */
  content?: string;
  draggable?: boolean;
}

/**
 * Acceso a Google Maps.
 *
 * El script se carga la primera vez que hace falta un mapa, no en el
 * `index.html`: así la clave sale de la configuración del entorno en lugar de
 * estar escrita en el HTML, y quien nunca abre un mapa no descarga la
 * biblioteca.
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsService {
  /**
   * Cierto cuando hay clave con la que pedir la biblioteca.
   *
   * Sin ella el mapa no es que falle: es que no está configurado, y eso no es
   * algo que quien rellena su dirección pueda arreglar ni deba leer.
   */
  readonly isConfigured = environment.googleMapsApiKey.length > 0;

  private loader?: Promise<void>;

  /** Carga la biblioteca. Las llamadas siguientes reutilizan la misma promesa. */
  async load(): Promise<void> {
    this.loader ??= this.injectScript();

    return this.loader;
  }

  async createMap(options: MapOptions): Promise<google.maps.Map> {
    await this.load();

    const map = new google.maps.Map(options.element, {
      center: options.center ?? DEFAULT_CENTER,
      zoom: options.zoom ?? 14,
      backgroundColor: '#fafafa',
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
    });

    const styled = new google.maps.StyledMapType(MapStyle, { name: 'App' });
    map.mapTypes.set('app', styled);
    map.setMapTypeId('app');

    // La clase se añade cuando el mapa termina de dibujarse, para poder
    // aparecerlo con una transición en lugar de mostrar el lienzo a medias.
    google.maps.event.addListenerOnce(map, 'idle', () => {
      options.element.classList.add('show-map');
    });

    return map;
  }

  async addMarker(options: MarkerOptions): Promise<google.maps.Marker> {
    await this.load();

    const marker = new google.maps.Marker({
      map: options.map,
      position: options.position,
      title: options.title,
      draggable: options.draggable ?? false,
    });

    if (options.content) {
      const info = new google.maps.InfoWindow({ content: options.content });
      marker.addListener('click', () => info.open({ map: options.map, anchor: marker }));
    }

    return marker;
  }

  /**
   * Busca las coordenadas de una dirección escrita.
   *
   * Usa el `Geocoder` de la biblioteca ya cargada en lugar de llamar a la API
   * REST de geocodificación: así la clave no viaja en una URL que quede en el
   * historial ni en los registros de red.
   */
  async geocode(address: string): Promise<google.maps.LatLngLiteral | null> {
    await this.load();

    const geocoder = new google.maps.Geocoder();

    try {
      const { results } = await geocoder.geocode({ address });
      const location = results[0]?.geometry.location;

      return location ? { lat: location.lat(), lng: location.lng() } : null;
    } catch {
      return null;
    }
  }

  /** Traduce unas coordenadas a los campos de una dirección. */
  async reverseGeocode(position: google.maps.LatLngLiteral): Promise<LocationInput | null> {
    await this.load();

    const geocoder = new google.maps.Geocoder();

    try {
      const { results } = await geocoder.geocode({ location: position });
      const components = results[0]?.address_components;

      return components ? toLocation(components, position) : null;
    } catch {
      return null;
    }
  }

  /**
   * Sugerencias para lo que se está escribiendo.
   *
   * Devuelve sitios con nombre, no sólo direcciones: quien publica algo dice
   * «en el parque de la Alameda», no la calle y el número.
   */
  async suggest(query: string): Promise<PlaceSuggestion[]> {
    const texto = query.trim();

    if (texto.length < 3) {
      return [];
    }

    await this.load();

    const servicio = new google.maps.places.AutocompleteService();

    try {
      const { predictions } = await servicio.getPlacePredictions({ input: texto });

      return predictions.map((prediction) => ({
        id: prediction.place_id,
        name: prediction.structured_formatting.main_text,
        address: prediction.structured_formatting.secondary_text ?? null,
      }));
    } catch {
      // Sin sugerencias no hay nada que enseñar, que no es lo mismo que un
      // error: puede que simplemente no haya nada que se parezca.
      return [];
    }
  }

  /** La dirección completa de una sugerencia ya elegida. */
  async place(placeId: string): Promise<LocationInput | null> {
    await this.load();

    const geocoder = new google.maps.Geocoder();

    try {
      const { results } = await geocoder.geocode({ placeId });
      const resultado = results[0];

      if (!resultado) {
        return null;
      }

      const position = {
        lat: resultado.geometry.location.lat(),
        lng: resultado.geometry.location.lng(),
      };

      return toLocation(resultado.address_components, position);
    } catch {
      return null;
    }
  }

  private injectScript(): Promise<void> {
    if (typeof google !== 'undefined' && google.maps) {
      return Promise.resolve();
    }

    if (!environment.googleMapsApiKey) {
      return Promise.reject(new Error('Falta googleMapsApiKey en la configuración del entorno.'));
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // `places` es lo que trae el buscador de sitios con nombre —«Plaza de
      // Armas»— en lugar de sólo direcciones postales.
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&loading=async&libraries=places`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Sin esto, un fallo de red dejaría cacheada una promesa rechazada y
        // ningún intento posterior volvería a cargar la biblioteca.
        this.loader = undefined;
        reject(new Error('No se pudo cargar Google Maps.'));
      };

      document.head.append(script);
    });
  }
}

/** Sitio propuesto mientras se escribe en el buscador. */
export interface PlaceSuggestion {
  /** Identificador de Google, con el que se piden luego sus datos. */
  id: string;
  /** Cómo se llama el sitio, o la calle si no tiene nombre. */
  name: string;
  /** El resto de la dirección, para distinguir dos sitios que se llaman igual. */
  address: string | null;
}

/** Arma una ubicación nuestra con los componentes que devuelve Google. */
function toLocation(
  components: google.maps.GeocoderAddressComponent[],
  position: google.maps.LatLngLiteral,
): LocationInput {
  return {
    country: pick(components, 'country'),
    state: pick(components, 'administrative_area_level_1'),
    city: pick(components, 'locality') ?? pick(components, 'administrative_area_level_2'),
    route: pick(components, 'route'),
    streetNumber: pick(components, 'street_number'),
    postalCode: pick(components, 'postal_code'),
    lat: position.lat,
    lng: position.lng,
  };
}

/** Extrae un componente de dirección por su tipo. */
function pick(
  components: google.maps.GeocoderAddressComponent[],
  type: string,
): string | null {
  return components.find((component) => component.types.includes(type))?.long_name ?? null;
}
