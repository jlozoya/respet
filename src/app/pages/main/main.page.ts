import { Component } from '@angular/core';

@Component({
  selector: 'app-main',
  templateUrl: 'main.page.html',
  styleUrls: ['main.page.scss']
})
export class MainPage {

  facebookChat = true;

  constructor(
  ) {
  }
  /**
   * Al entrar a la vista abre el chat de facebook
   */
  ionViewDidEnter() {
    this.facebookChat = true;
  }
  /**
   * Al salir de la vista cierra el chat de facebook
   */
  ionViewDidLeave() {
    this.facebookChat = false;
  }
}
