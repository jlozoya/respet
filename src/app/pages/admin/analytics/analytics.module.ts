import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComponentsModule } from '../../../components/components.module';
import { TranslateModule } from '@ngx-translate/core';

import { AnalyticsPage } from './analytics.page';

@NgModule({
  declarations: [
    AnalyticsPage,
  ],
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    RouterModule.forChild([{ path: '', component: AnalyticsPage }]),
    TranslateModule.forChild(),
    ComponentsModule
  ]
})
export class AnalyticsPageModule { }
