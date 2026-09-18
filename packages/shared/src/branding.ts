/**
 * La marca: cómo se llama esto, de qué color es y dónde encontrarlo.
 *
 * No está escrita en el código. La API la arma con variables de entorno
 * (`APP_NAME`, `APP_LOGO_URL`, `APP_BRAND_COLOR`…), la sirve en la consulta
 * pública `branding` y la aplicación la aplica al arrancar: el nombre en los
 * textos, el logotipo en la cabecera, los colores en las variables CSS. Quien
 * despliegue esto puede ponerle su nombre sin tocar una línea ni recompilar.
 *
 * La aplicación además la lee de `env.js` —que la imagen de Docker escribe al
 * arrancar— para pintar la primera pantalla con la marca correcta, sin esperar
 * a que responda la API.
 */
export interface Branding {
  /** El nombre, tal cual aparece en los textos: «{{app}} necesita tu permiso». */
  name: string;
  /** Una línea, debajo del nombre en la pantalla de entrada. */
  tagline: string;
  /** Dos o tres líneas, para la página «acerca de» y las etiquetas `og:`. */
  description: string;
  /** Logotipo horizontal, para la cabecera. Sin él se dibuja la marca por defecto. */
  logoUrl: string | null;
  /** Icono cuadrado, para la pestaña del navegador y los correos. */
  iconUrl: string | null;
  /** Color principal, en hexadecimal. De él salen el resto de tonos. */
  brandColor: string;
  /** Degradado de los adornos —el aro de las historias, los botones grandes—. */
  brandGradient: string;
  /** Sitio web público, si lo hay. */
  website: string | null;
  /** Buzón de contacto que se enseña en la aplicación. */
  publicMail: string | null;
  /** Teléfono de contacto, si se quiere enseñar uno. */
  phone: string | null;
  /** Dirección postal, para el pie de página. */
  address: string | null;
  facebook: string | null;
  instagram: string | null;
}

/**
 * Lo que se usa cuando no hay nada configurado.
 *
 * Es también lo que compila la aplicación, así que la primera pantalla nunca
 * se queda sin nombre ni sin color.
 */
export const DEFAULT_BRANDING: Branding = {
  name: 'Social Network',
  tagline: 'Comparte lo que te importa con quien te importa.',
  description:
    'Una red social para contar lo que pasa a tu alrededor, seguir a quien te interesa y hablar con quien quieras.',
  logoUrl: null,
  iconUrl: null,
  brandColor: '#f05a22',
  brandGradient: 'linear-gradient(135deg, #f05a22 0%, #f7931e 100%)',
  website: null,
  publicMail: null,
  phone: null,
  address: null,
  facebook: null,
  instagram: null,
};
