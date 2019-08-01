import { IonicModule } from '@ionic/angular';
import { PopAdminBulletin } from './pop-admin-bulletin';
import { NgModule } from '@angular/core';

import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  declarations: [
    PopAdminBulletin,
  ],
  imports: [
    IonicModule,
    TranslateModule.forChild()
  ],
  entryComponents: [
    PopAdminBulletin
  ],
  exports: [
    PopAdminBulletin
  ]
})
export class PopAdminBulletinModule {}
