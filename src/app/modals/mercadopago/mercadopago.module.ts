import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { MercadopagoComponent } from './mercadopago.component';

@NgModule({
  declarations: [MercadopagoComponent],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    TranslateModule
  ],
  entryComponents: [
    MercadopagoComponent
  ],
  exports: [
    MercadopagoComponent
  ]
})
export class MercadopagoComponentModule {}