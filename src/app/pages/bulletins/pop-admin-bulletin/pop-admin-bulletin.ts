import { PopoverController } from '@ionic/angular';
import { Component } from '@angular/core';

/**
 * Genera un pop up, proporciona opciones.
 * @author Juan Lozoya <jlozoya1995@gmail.com>
 */
@Component({
  selector: './pop-admin-bulletin',
  templateUrl: './pop-admin-bulletin.html',
  styleUrls: ['./pop-admin-bulletin.scss']
})
export class PopAdminBulletin {

  constructor(
    private popoverCtrl: PopoverController,
  ) {
  }
  update() {
    this.dismiss('update');
  }
  delete() {
    this.dismiss('delete');
  }
  /**
   * Al cerrar el pop se puede regresar un mensaje.
   * @param {string} message
   */
  dismiss(message: string) {
    this.popoverCtrl.dismiss(message);
  }
}
