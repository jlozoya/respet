import { AddEmailsPhonesComponent } from './add-emails-phones.component';
import { ImageCropperModule } from 'ngx-image-cropper';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';


@NgModule({
  declarations: [
    AddEmailsPhonesComponent
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ImageCropperModule,
    TranslateModule
  ],
  entryComponents: [
    AddEmailsPhonesComponent
  ],
  exports: [
    AddEmailsPhonesComponent
  ]
})
export class AddEmailsPhonesComponentModule {}
