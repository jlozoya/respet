import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { TranslatePipe } from '@ngx-translate/core';

import { BrandComponent } from '../../components/shell/brand.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { BrandingService } from '../../core/branding/branding.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/**
 * Qué es esto y quién está detrás.
 *
 * No hay nada escrito en la página: el nombre, el eslogan, la descripción y
 * los enlaces salen de la marca que sirve la API, de modo que cada instalación
 * se presenta con lo suyo.
 */
@Component({
  selector: 'app-about',
  templateUrl: 'about.page.html',
  styleUrls: ['about.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, PageHeaderComponent, FooterComponent, BrandComponent, IonContent],
})
export class AboutPage {
  readonly branding = inject(BrandingService).branding;
}
