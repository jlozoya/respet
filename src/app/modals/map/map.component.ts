import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ApiService, GoogleMapsApiService, Post } from '../../providers/providers';
import { ModalController, NavParams, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-map',
  templateUrl: 'map.component.html',
  styleUrls: ['map.component.scss']
})
export class MapComponent implements AfterViewInit {

  map;
  markers = [];
  @ViewChild('mapCanvas', {static: false}) mapElement: ElementRef;

  constructor(
    private api: ApiService,
    private navParams: NavParams,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private googleMapsApi: GoogleMapsApiService,
  ) {
  }

  ngAfterViewInit(): void {
    this.setMap(this.navParams.get('post'));
  }
  /**
   * Establece el mapa.
   * @param {User} user
   */
  private async setMap(post: Post) {
    const mapElement = this.mapElement.nativeElement;
    let latLng = {lat: 24.020, lng: -104.658};
    if (post.direction && post.direction.lat && post.direction.lng) {
      latLng.lat = parseFloat(post.direction.lat);
      latLng.lng = parseFloat(post.direction.lng);
    }
    this.map = await this.googleMapsApi.setMap({map: this.map, mapElement, latLng});
    if (post.direction && post.direction.lat && post.direction.lng) {
      this.map.setCenter(latLng);
      this.addMarker(post);
    }
    this.getAnotherPoints(post).then((posts: Post[]) => {
      posts.forEach((inPost) => {
        if (inPost.id !== post.id) {
          this.addMarker(inPost);
        }
      });
    }, (fail) => {
      console.log('[posts-51]', fail);
    });
  }

  async getAnotherPoints(post: Post) {
    return await this.api.get(`/posts?latLng=${post.direction.lat},${post.direction.lng}`);
  }
  /**
   * Establece la pocición del markador del usuario.
   * @param {Usre} user
   */
  private async addMarker(post: Post) {
    const latLng = {lat: parseFloat(post.direction.lat), lng: parseFloat(post.direction.lng)};
    if (latLng.lat !== 0 && latLng.lng !== 0) {
      const {marker} = await this.googleMapsApi.setMarker({
        content: `<p>${post.description}</p>`,
        latLng,
        map: this.map,
        title: post.description,
        draggable: false
      });
      this.markers.push(marker);
      if (post.direction_accuracy) {
        this.googleMapsApi.addCircle({
          map: this.map,
          center: latLng,
          radius: post.direction_accuracy
        });
      }
    }
  }
  /**
  * Cierra el modal.
  */
  dismiss(): void {
    this.modalCtrl.dismiss();
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
