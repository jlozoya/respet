import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { ControlMessagesComponent } from './components/control-messages.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@NgModule({
  declarations: [
    ControlMessagesComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule
  ],
  exports: [
    ControlMessagesComponent
  ]
})
export class SharedModule {}
