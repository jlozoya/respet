import { AddEmailsPhonesComponentModule } from './../../../modals/add-emails-phones/add-emails-phones.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { PrivacyPage } from './privacy.page';
import { TranslateModule } from '@ngx-translate/core';

const routes: Routes = [
  {
    path: '',
    component: PrivacyPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    RouterModule.forChild(routes),
    AddEmailsPhonesComponentModule
  ],
  declarations: [PrivacyPage]
})
export class PrivacyPageModule {}
