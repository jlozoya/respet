import { MapComponent } from './map.component';
import { ImageCropperModule } from 'ngx-image-cropper';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';


@NgModule({
  declarations: [
    MapComponent
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ImageCropperModule,
    TranslateModule
  ],
  entryComponents: [
    MapComponent
  ],
  exports: [
    MapComponent
  ]
})
export class MapComponentModule {}
