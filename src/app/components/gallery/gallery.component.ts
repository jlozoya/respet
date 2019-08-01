import { ModalController } from '@ionic/angular';
import { Media } from './../../providers/providers';
import { Component, OnInit, Input } from '@angular/core';
import { ImgModalComponent } from './img-modal/img-modal.component';
import { OverlayEventDetail } from '@ionic/core';

@Component({
  selector: 'app-gallery',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss']
})
export class GalleryComponent implements OnInit {

  offset = 0;
  @Input()imgs: Media[] = [];
  @Input()source = '';
  @Input()source_id = 1;

  constructor(
    private modalCtrl: ModalController
  ) { }

  ngOnInit() {
    if (this.imgs && this.imgs.length > 5) {
      this.offset = this.imgs.length - 5;
    }
  }

  async openImgModal(img: Media) {
    const imgModal = await this.modalCtrl.create(
      {
        component: ImgModalComponent,
        componentProps: {
          imgs: this.imgs,
          position: this.imgs.indexOf(img),
          source: this.source,
          source_id: this.source_id
        }
      }
    );
    setTimeout(() => {
      imgModal.present();
    }, 500);
    imgModal.onDidDismiss().then((detail: OverlayEventDetail) => {
      // console.log(detail);
    });
  }
}
