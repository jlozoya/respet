import { Component, OnInit } from '@angular/core';
import { ModalController, NavParams } from '@ionic/angular';
/**
 * Genera un modal, muestra un formulario para crear una nueva organización de viaje.
 * @author <a href="mailto:jlozoya1995@gmail.com">Juan Lozoya</a>
 *
 * @param {1/1 | 4 / 3 | 16 / 9} aspectRatio
 * @param {number} targetWidth
 * @param {string} imageBase64
 *
 * @returns string
 */
@Component({
  selector: 'app-crop-img',
  templateUrl: 'crop-img.component.html',
  styleUrls: ['crop-img.component.scss']
})
export class CropImgComponent implements OnInit {

  imageBase64 = '';
  croppedImage = '';
  targetWidth = 200;
  aspectRatio = 1;

  constructor(
    private modalCtrl: ModalController,
    private navParams: NavParams
  ) {
  }
  /**
   * Lee los parametros de entrada.
   */
  ngOnInit() {
    this.aspectRatio = this.navParams.get('aspectRatio') || 1;
    this.targetWidth = this.navParams.get('targetWidth') || 200;
    this.imageBase64 = this.navParams.get('imageBase64');
  }
  /**
   * Regresa la imagen recortada.
   * @param {string} image
   */
  imageCropped(image: string) {
    this.croppedImage = image;
  }
  /**
   * Cierra la vista.
   */
  returnImg(): void {
    this.modalCtrl.dismiss(this.croppedImage || this.imageBase64, 'img');
  }
  /**
   * Cierra el modal.
   */
  dismiss(): void {
    this.modalCtrl.dismiss();
  }
}
