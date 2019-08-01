import { Post } from './../../../providers/models/models';
import { Component } from '@angular/core';
import { ModalController, NavParams, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-post-update',
  templateUrl: 'post-update.component.html',
  styleUrls: ['post-update.component.scss']
})
export class PostUpdateComponenet {

  postId: number;

  constructor(
    private modalCtrl: ModalController,
    private navParams: NavParams,
    private toastCtrl: ToastController
  ) {
    this.postId = this.navParams.get('postId');
  }
  /**
   * Cierra el modal.
   */
  dismiss(post: Post): void {
    this.modalCtrl.dismiss(post);
  }
  /**
   * Presenta un cuadro de mensaje.
   * @param {string} text Mensaje a mostrar.
   */
  async presentToast(text: string) {
    const toast = await this.toastCtrl.create({
      message: text,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }
}
