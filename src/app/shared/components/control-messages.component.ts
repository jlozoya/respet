import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ValidationService } from '../directives/validation.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'control-messages',
  template: `<div *ngIf="errorMessage !== null">
    <ion-label color="danger">{{errorMessage}}</ion-label>
  </div>`,
  styles: ['ion-label { padding-left: 15px; }']
})
export class ControlMessagesComponent {
  @Input() control: FormControl;
  constructor(private translate: TranslateService) { }

  get errorMessage() {
    for (const propertyName in this.control.errors) {
      if (this.control.errors.hasOwnProperty(propertyName) && this.control.touched) {
        return `${this.translate.instant(ValidationService.getValidatorErrorMessage(propertyName,
          this.control.errors[propertyName]))} ${this.control.errors[propertyName].requiredLength || ''}`;
      }
    }
    return null;
  }
}
