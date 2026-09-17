import { DeviceType } from '../../database/schemas/enums.js';

export interface ParsedDevice {
  type: DeviceType;
  name: string;
  browser: string | null;
  os: string | null;
}

/**
 * Un nombre reconocible para el dispositivo de una sesión.
 *
 * No pretende identificar el modelo exacto —para eso harían falta bases de
 * datos enormes que envejecen cada mes—, sino que la lista de sesiones se lea
 * como «Chrome en Windows» o «App de Respet en Android» y no como una cadena
 * de agente de usuario de doscientos caracteres.
 */
export function parseUserAgent(userAgent: string | null | undefined): ParsedDevice {
  const ua = userAgent ?? '';

  if (!ua) {
    return { type: DeviceType.Unknown, name: 'Unknown device', browser: null, os: null };
  }

  const os = detectOs(ua);
  const browser = detectBrowser(ua);
  const type = detectType(ua);

  // La aplicación nativa corre en un WebView: el navegador no dice nada a
  // quien mira la lista, la plataforma sí.
  const isApp = /RespetApp|; wv\)|Capacitor/i.test(ua);
  const name = isApp
    ? `Respet app${os ? ` · ${os}` : ''}`
    : [browser, os].filter(Boolean).join(' · ') || 'Unknown device';

  return { type, name, browser: isApp ? 'Respet app' : browser, os };
}

function detectOs(ua: string): string | null {
  if (/Windows NT/i.test(ua)) {
    return 'Windows';
  }

  if (/Android/i.test(ua)) {
    return 'Android';
  }

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'iOS';
  }

  if (/Mac OS X|Macintosh/i.test(ua)) {
    return 'macOS';
  }

  if (/CrOS/i.test(ua)) {
    return 'ChromeOS';
  }

  if (/Linux/i.test(ua)) {
    return 'Linux';
  }

  return null;
}

function detectBrowser(ua: string): string | null {
  // El orden importa: Edge y Opera se anuncian también como Chrome, y Chrome
  // también como Safari.
  const candidates: [RegExp, string][] = [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/SamsungBrowser/, 'Samsung Internet'],
    [/Firefox\//, 'Firefox'],
    [/Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
    [/curl\//i, 'curl'],
    [/PostmanRuntime/i, 'Postman'],
    [/node-fetch|undici|axios/i, 'API client'],
  ];

  return candidates.find(([pattern]) => pattern.test(ua))?.[1] ?? null;
}

function detectType(ua: string): DeviceType {
  if (/iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)) {
    return DeviceType.Tablet;
  }

  if (/Mobi|iPhone|iPod|Android/i.test(ua)) {
    return DeviceType.Mobile;
  }

  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) {
    return DeviceType.Desktop;
  }

  return DeviceType.Unknown;
}
