import { Injectable, computed, inject, signal } from '@angular/core';
import { DEFAULT_BRANDING, type Branding } from '@social-network/shared';

import { environment } from '../../../environments/environment';
import { GraphqlClientService } from '../api/graphql-client.service';
import { contrastOf, rgbOf, shadeOf, tintOf } from './color';

const BRANDING = `query Branding {
  branding {
    name
    tagline
    description
    logoUrl
    iconUrl
    brandColor
    brandGradient
    website
    publicMail
    phone
    address
    facebook
    instagram
  }
}`;

/** Lo que tarda como mucho en esperarse a la API antes de tirar con lo compilado. */
const QUERY_TIMEOUT_MS = 3000;

/**
 * La marca de esta instalación.
 *
 * Nada de lo que se ve —el nombre, el eslogan, el logotipo, los colores, los
 * enlaces— está escrito en el código: sale de las variables `APP_*` del
 * servidor, que las sirve en la consulta pública `branding`. La aplicación
 * arranca con lo que trae compilado, o con lo que haya escrito `env.js`, y lo
 * sustituye en cuanto la API responde.
 *
 * `restore()` se espera al arrancar, con un tope de tres segundos: los textos
 * llevan el nombre dentro —«Al continuar, la aplicación podrá usar {{app}}»—,
 * así que conviene tenerlo antes de pintar y no cambiarlo a media frase.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private readonly graphql = inject(GraphqlClientService);

  private readonly brandingSignal = signal<Branding>({
    ...DEFAULT_BRANDING,
    ...environment.branding,
  });

  readonly branding = this.brandingSignal.asReadonly();

  /** El nombre, que es lo que más se usa: cabeceras, textos, pie de página. */
  readonly name = computed(() => this.branding().name);

  /** Enlaces y contacto, ya listos para un `href`. */
  readonly links = computed(() => {
    const { website, publicMail, phone, facebook, instagram } = this.branding();

    return {
      website,
      facebook,
      instagram,
      phone,
      mail: publicMail ? `mailto:${publicMail}` : null,
      tel: phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : null,
    };
  });

  /** Aplica lo que haya y pide a la API la marca de verdad. La llama `provideAppInitializer`. */
  async restore(): Promise<void> {
    // Primero lo que ya se tiene: si la API tarda o no está, la aplicación se
    // pinta igualmente con un nombre y unos colores coherentes.
    this.apply();

    const served = await this.fetch();

    if (served) {
      this.brandingSignal.set({ ...DEFAULT_BRANDING, ...served });
      this.apply();
    }
  }

  private async fetch(): Promise<Branding | null> {
    try {
      return await Promise.race([
        this.graphql.field<Branding>(BRANDING),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), QUERY_TIMEOUT_MS)),
      ]);
    } catch {
      // Sin API —sin red, o recién arrancada— vale la marca compilada.
      return null;
    }
  }

  /**
   * Vuelca la marca en el documento: variables CSS, título, etiquetas y icono.
   *
   * Los colores se escriben en `<html>` porque ahí pisan a los de
   * `variables.scss` sin necesidad de recompilar la hoja de estilos, y los
   * tonos derivados —el de pulsado, el del texto encima— se calculan a partir
   * del principal para que el conjunto siga siendo legible con cualquier color.
   */
  private apply(): void {
    const brand = this.branding();
    const root = document.documentElement;

    root.style.setProperty('--ion-color-primary', brand.brandColor);
    root.style.setProperty('--ion-color-primary-rgb', rgbOf(brand.brandColor));
    root.style.setProperty('--ion-color-primary-shade', shadeOf(brand.brandColor));
    root.style.setProperty('--ion-color-primary-tint', tintOf(brand.brandColor));
    root.style.setProperty('--ion-color-primary-contrast', contrastOf(brand.brandColor));
    root.style.setProperty('--ion-color-primary-contrast-rgb', rgbOf(contrastOf(brand.brandColor)));
    root.style.setProperty('--rs-brand-gradient', brand.brandGradient);

    document.title = brand.name;
    meta('name', 'description', brand.description);
    meta('name', 'application-name', brand.name);
    meta('name', 'apple-mobile-web-app-title', brand.name);
    meta('property', 'og:title', brand.name);
    meta('property', 'og:site_name', brand.name);
    meta('property', 'og:description', brand.description);

    if (brand.iconUrl) {
      icon(brand.iconUrl);
    }
  }
}

/** Escribe una etiqueta `<meta>`, creándola si no estaba. */
function meta(attribute: 'name' | 'property', key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }

  tag.content = content;
}

function icon(url: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }

  link.href = url;
}
