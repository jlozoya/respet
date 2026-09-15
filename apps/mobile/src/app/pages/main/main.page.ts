import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonRow } from '@ionic/angular/ion-row';

import { BulletinComponent } from '../../components/bulletin/bulletin.component';
import { FooterComponent } from '../../components/footer/footer.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/** Portada: últimos avisos y pie con el formulario de contacto. */
@Component({
  selector: 'app-main',
  templateUrl: 'main.page.html',
  styleUrls: ['main.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, BulletinComponent, FooterComponent, IonContent, IonRow, IonCol],
})
export class MainPage {}
