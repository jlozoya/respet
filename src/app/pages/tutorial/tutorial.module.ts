import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TutorialPage } from './tutorial.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [
    TutorialPage,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterModule.forChild([{ path: '', component: TutorialPage }]),
    TranslateModule.forChild()
  ]
})
export class TutorialPageModule { }
