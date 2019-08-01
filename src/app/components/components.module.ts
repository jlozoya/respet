import { AddEmailsPhonesComponentModule } from './../modals/add-emails-phones/add-emails-phones.module';
import { MapComponentModule } from './../modals/map/map.module';
import { SharedModule } from './../shared/shared.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FooterComponent } from './footer/footer.component';
import { BulletinComponent } from './bulletin/bulletin.component';
import { GalleryComponent } from './gallery/gallery.component';
import { ImgModalComponent } from './gallery/img-modal/img-modal.component';
import { PostCardComponent, PostCardPopComponent } from './post/post-card/post-card.component';
import { PostFormComponent } from './post/post-form/post-form.component';
import { PostUpdateComponenet } from './post/post-update/post-update.component';
import { TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserCardComponent } from './user/user-card/user-card.component';

@NgModule({
  declarations: [
    UserCardComponent,
    PostFormComponent,
    PostCardPopComponent,
    PostCardComponent,
    FooterComponent,
    BulletinComponent,
    GalleryComponent,
    PostUpdateComponenet,
    ImgModalComponent
  ],
  imports: [
    IonicModule,
    CommonModule,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    MapComponentModule,
    AddEmailsPhonesComponentModule,
    TranslateModule.forChild()
  ],
  exports: [
    UserCardComponent,
    PostFormComponent,
    PostCardPopComponent,
    PostUpdateComponenet,
    PostCardComponent,
    FooterComponent,
    BulletinComponent,
    GalleryComponent
  ],
  entryComponents: [
    ImgModalComponent,
    PostCardPopComponent,
    PostUpdateComponenet
  ]
})
export class ComponentsModule {}
