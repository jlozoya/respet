import { Pipe, type PipeTransform } from '@angular/core';

/** Una duración en milisegundos como `m:ss`, para vídeos y notas de voz. */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(ms: number | null | undefined): string {
    return formatDuration(ms);
  }
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms < 0) {
    return '0:00';
  }

  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Un tamaño de archivo legible: «2,4 MB». */
@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(bytes: number | null | undefined): string {
    if (!bytes) {
      return '';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }

    return `${value.toLocaleString(undefined, { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
  }
}
