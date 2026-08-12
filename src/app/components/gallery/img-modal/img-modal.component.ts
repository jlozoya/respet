import { NavParams, ModalController } from '@ionic/angular';
import { Media } from './../../../providers/models/models';
import { Component, OnInit } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-img-modal',
  templateUrl: './img-modal.component.html',
  styleUrls: ['./img-modal.component.scss']
})
export class ImgModalComponent implements OnInit {

  imgs: Media[] = [];
  position: number;
  source: string;
  source_id: number;

  constructor(
    private modalCtrl: ModalController,
    private navParams: NavParams
  ) {}

  ngOnInit() {
    this.imgs = this.navParams.get('imgs');
    this.position = this.navParams.get('position') || 0;
    this.source = this.navParams.get('source') || '';
    this.source_id = this.navParams.get('source_id') || 1;
  }

  /**
   * Cierra el modal.
   */
  dismiss(): void {
    this.modalCtrl.dismiss();
  }
}
