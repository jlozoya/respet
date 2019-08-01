import { NavParams, ModalController, IonSlides } from '@ionic/angular';
import { Media } from './../../../providers/models/models';
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-img-modal',
  templateUrl: './img-modal.component.html',
  styleUrls: ['./img-modal.component.scss']
})
export class ImgModalComponent implements OnInit, AfterViewInit {

  imgs: Media[] = [];
  position: number;
  source: string;
  source_id: number;
  @ViewChild('mySlider', {static: false}) slider: IonSlides;

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

  ngAfterViewInit(): void {
    this.slider.slideTo(this.position, 500);
  }

  /**
   * Cierra el modal.
   */
  dismiss(): void {
    this.modalCtrl.dismiss();
  }
}
