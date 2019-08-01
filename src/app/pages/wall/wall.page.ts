import { ActivatedRoute } from '@angular/router';
import { Component, ViewChild, ElementRef } from '@angular/core';
import { Post, ApiService, Pagination, UserContact, GoogleMapsApiService } from './../../providers/providers';

@Component({
  selector: 'app-wall',
  templateUrl: './wall.page.html',
  styleUrls: ['./wall.page.scss'],
})
export class WallPage {

  userContact: UserContact;
  userId: number;
  infoWindow;
  marker;
  map;
  posts: Post[] = [];
  lastPage = 1;
  search = '';
  @ViewChild('mapCanvas', {static: false}) mapElement: ElementRef;

  constructor(
    private api: ApiService,
    private googleMapsApi: GoogleMapsApiService,
    private route: ActivatedRoute
  ) {
  }

  ionViewDidEnter() {
    this.route.params.subscribe(async (params) => {
      this.userId = params.user_id;
      if (this.userId) {
        this.getUserContact(this.userId);
      }
      this.getPosts(this.lastPage, this.userId);
    });
  }

  addPost(post: Post) {
    this.posts.unshift(post);
  }
  /**
   * Recupera la información de los usuarios.
   * @param {number} page
   * @param {string} search
   * @return {Promise<boolean>} Regresa verdadero en caso de obtener más información y false en caso de obtener un error.
   */
  getPosts(page: number = 1, user_id: number = null, search: string = ''): Promise<boolean> {
    return new Promise((result) => {
      this.lastPage = page;
      const path = (user_id) ? `/posts?page=${page}&user_id=${user_id}&search=${search}` : `/posts?page=${page}&search=${search}`;
      this.api.get(path).then((response: Pagination) => {
        if (page === 1) {
          this.posts = response.data;
        } else {
          response.data.map(posts => {
            this.posts.push(posts);
          });
        }
        result(true);
      }, (fail) => {
        console.log('[posts-51]', fail);
        result(false);
      });
    });
  }
  /**
   * Obtiene la información de un usuario.
   * @param {number} user_id
   * @param {number} page
   */
  async getUserContact(userId: number) {
    this.userContact = await this.api.get(`/user/contact/${userId}`).catch((error) => {
      console.log('[wall-72]', error);
    });
    if (this.userContact && this.userContact.contact && this.userContact.contact.address) {
      this.setMap(this.userContact);
    }
  }
  /**
   * Muestra un mapa.
   * @param {UserContact} userContact
   */
  async setMap(userContact: UserContact) {
    const latLng = {
      lat: parseFloat(userContact.contact.address.lat),
      lng: parseFloat(userContact.contact.address.lng)
    };
    const mapElement = this.mapElement.nativeElement;
    this.map = await this.googleMapsApi.setMap({map: this.map, mapElement,
      latLng});
    this.setMarker(userContact);
  }
  /**
   * Establece la pocición del markador del usuario.
   * @param {UserContact} userContact
   */
  private async setMarker(userContact: UserContact) {
    const latLng = {
      lat: parseFloat(userContact.contact.address.lat),
      lng: parseFloat(userContact.contact.address.lng)
    };
    if (!this.marker) {
      const {marker, infoWindow} = await this.googleMapsApi.setMarker({
        content: `<h5>${userContact.name}</h5>`,
        latLng,
        map: this.map,
        title: userContact.name,
        draggable: false
      });
      this.marker = marker;
      this.infoWindow = infoWindow;
    } else {
      this.map.setCenter(latLng);
      this.marker.setPosition(latLng);
      this.infoWindow.setContent(`<h5>${userContact.name}</h5>`);
    }
  }
  /**
   * Elimina un elemento de la lista.
   * @param {Post} post
   */
  delete(post: Post) {
    this.posts.splice(this.posts.indexOf(post), 1);
  }
  /**
   * Refresca la página.
   * @param event
   */
  doRefresh(event) {
    this.lastPage = 1;
    this.getPosts(this.lastPage).then(() => {
      event.target.complete();
    });
  }
  /**
   * Llama a la función para cargar mas elementos cuando la página llega al final.
   * @param infiniteScroll
   */
  doScrollDown(infiniteScroll) {
    this.getPosts(this.lastPage + 1, this.userId, this.search).then((success) => {
      infiniteScroll.target.complete();
    });
  }

  mailTo(email: string) {
    location.href = `mailto:${email}`;
  }

  callTo(phone: string) {
    location.href = `tel:+${phone}`;
  }
}
