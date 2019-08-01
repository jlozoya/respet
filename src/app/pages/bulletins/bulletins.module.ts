import { PopAdminBulletinModule } from './pop-admin-bulletin/pop-admin-bulletin.module';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { BulletinsPage } from './bulletins.page';
import { ModalBulletinPageModule } from './modal-bulletin/modal-bulletin.module';

const routes: Routes = [
  {
    path: '',
    component: BulletinsPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    ModalBulletinPageModule,
    PopAdminBulletinModule
  ],
  declarations: [BulletinsPage]
})
export class BulletinsPageModule {}
