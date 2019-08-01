import { SharedModule } from './../../../shared/shared.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ModalBulletinPage } from './modal-bulletin.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [
    ModalBulletinPage
  ],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    ReactiveFormsModule,
    TranslateModule
  ],
  entryComponents: [
    ModalBulletinPage
  ],
  exports: [
    ModalBulletinPage
  ]
})
export class ModalBulletinPageModule {}
