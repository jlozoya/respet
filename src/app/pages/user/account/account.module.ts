import { CropImgComponentModule, } from './../../../modals/crop-img/crop-img.module';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from './../../../shared/shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { AccountPage } from './account.page';
import { UserFormComponent } from './user-form/user-form.component';
import { AvatarComponent } from './avatar/avatar.component';
import { OptionsComponent } from './options/options.component';

@NgModule({
  declarations: [
    AccountPage,
    UserFormComponent,
    AvatarComponent,
    OptionsComponent
  ],
  imports: [
    CropImgComponentModule,
    IonicModule,
    CommonModule,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild([{ path: '', component: AccountPage }]),
    TranslateModule.forChild()
  ]
})
export class AccountPageModule {}
