import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import type { Bulletin } from '@respet/shared';

import { BulletinsService } from '../../../core/api/content.service';

/** Cuántos avisos caben en la columna sin convertirla en otra lista larga. */
const CUANTOS = 4;

/**
 * Columna de la derecha del muro: lo que pasa alrededor.
 *
 * Enseña los últimos avisos, que hasta ahora había que ir a buscar a su propia
 * pantalla. Si no hay ninguno, o si la petición falla, no pinta nada: una
 * columna vacía con un título es peor que ninguna columna.
 */
@Component({
  selector: 'app-info-rail',
  templateUrl: './info-rail.component.html',
  styleUrls: ['./info-rail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, TranslatePipe],
})
export class InfoRailComponent {
  private readonly bulletins = inject(BulletinsService);

  readonly items = signal<readonly Bulletin[]>([]);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const page = await this.bulletins.list({ page: 1, perPage: CUANTOS });

      this.items.set(page.data);
    } catch {
      // Es contenido accesorio: si falla, el muro sigue siendo el muro.
      this.items.set([]);
    }
  }
}
