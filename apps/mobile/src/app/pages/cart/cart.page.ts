import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonCol } from '@ionic/angular/ion-col';
import { IonContent } from '@ionic/angular/ion-content';
import { IonRow } from '@ionic/angular/ion-row';

import { CartFormComponent } from '../../components/cart/cart-form/cart-form.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, CartFormComponent, IonContent, IonRow, IonCol],
})
export class CartPage {}
