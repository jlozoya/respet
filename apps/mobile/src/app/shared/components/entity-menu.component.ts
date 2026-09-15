import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { PopoverController } from '@ionic/angular/popover-controller';
import { TranslatePipe } from '@ngx-translate/core';

export type EntityMenuAction = 'update' | 'delete' | 'report';

/**
 * Menú contextual de una tarjeta.
 *
 * Lo comparten las publicaciones, los productos, las bodegas y los avisos.
 * Antes cada tarjeta declaraba su propio `@Component` dentro del mismo archivo,
 * lo que impedía cargarlos por separado.
 */
@Component({
  selector: 'app-entity-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonList, IonItem, IonLabel],
  template: `
    <ion-list lines="full">
      @if (canUpdate()) {
        <ion-item button detail="false" (click)="select('update')">
          <ion-label>{{ 'UPDATE' | translate }}</ion-label>
        </ion-item>
      }

      @if (canReport()) {
        <ion-item button detail="false" (click)="select('report')">
          <ion-label>{{ 'REPORT' | translate }}</ion-label>
        </ion-item>
      }

      @if (canDelete()) {
        <ion-item button detail="false" (click)="select('delete')">
          <ion-label color="danger">{{ 'DELETE' | translate }}</ion-label>
        </ion-item>
      }
    </ion-list>
  `,
})
export class EntityMenuComponent {
  private readonly popoverCtrl = inject(PopoverController);

  readonly canUpdate = input(false);
  readonly canDelete = input(false);
  readonly canReport = input(false);

  select(action: EntityMenuAction): void {
    void this.popoverCtrl.dismiss(action);
  }
}
