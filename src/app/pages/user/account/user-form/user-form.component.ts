import { Component, ElementRef, ViewChild, Input, OnChanges, OnInit } from '@angular/core';
import { ToastController, Platform, Events } from '@ionic/angular';
import { FormBuilder, Validators } from '@angular/forms';
import { ApiService, StorageService, User, Address,
  GoogleMapsApiService, LatLng } from './../../../../providers/providers';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.scss']
})
export class UserFormComponent implements OnInit, OnChanges {

  @Input()user: User;
  userForm: any;
  isReadyToUpdate = false;
  isPrimary = false;
  @Input()isSelf = true;
  map;
  marker;
  infoWindow;
  @ViewChild('mapCanvas', {static: false}) mapElement: ElementRef;

  constructor(
    private toastCtrl: ToastController,
    private platform: Platform,
    private storage: StorageService,
    private api: ApiService,
    private translate: TranslateService,
    private events: Events,
    private googleMapsApi: GoogleMapsApiService,
    formBuilder: FormBuilder
  ) {
    this.userForm = formBuilder.group({
      id: [''],
      name: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(60)]],
      first_name: ['', [Validators.required, Validators.maxLength(60)]],
      last_name: ['', [Validators.required, Validators.maxLength(60)]],
      gender: ['', Validators.nullValidator],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.maxLength(15)],
      birthday: ['', Validators.nullValidator],
      lang: ['es', Validators.nullValidator],
      address: formBuilder.group({
        country: ['', Validators.maxLength(60)],
        administrative_area_level_1: ['', Validators.maxLength(60)],
        administrative_area_level_2: ['', Validators.maxLength(60)],
        route: ['', Validators.maxLength(60)],
        street_number: ['', Validators.nullValidator],
        postal_code: ['', Validators.nullValidator],
        lat: ['', Validators.nullValidator],
        lng: ['', Validators.nullValidator],
      })
    });
  }

  ngOnInit(): void {
    this.userForm.valueChanges.subscribe((v) => {
      this.isReadyToUpdate = this.userForm.valid;
    });
  }

  ngOnChanges() {
    if (this.user) {
      this.setUserData(this.user);
    }
  }
  /**
   * Coloca la información del usuario en los formularios.
   */
  setUserData(user: User) {
    this.userForm.patchValue({
      id: user.id,
      name: user.name,
      first_name: user.first_name,
      last_name: user.last_name,
      gender: user.gender,
      email: user.email,
      phone: user.phone,
      birthday: user.birthday,
      lang: user.lang,
    });
    if (user.address) {
      this.userForm.patchValue({
        address: {
          country: user.address.country,
          administrative_area_level_1: user.address.administrative_area_level_1,
          administrative_area_level_2: user.address.administrative_area_level_2,
          route: user.address.route,
          street_number: user.address.street_number,
          postal_code: user.address.postal_code,
          lat: user.address.lat,
          lng: user.address.lng,
        }
      });
    }
    this.platform.ready().then(() => {
      this.setMap(user);
    });
  }
  /**
   * Establece el mapa.
   * @param {User} user
   */
  private async setMap(user: User) {
    const mapElement = this.mapElement.nativeElement;
    let latLng = {lat: 24.020, lng: -104.658};
    if (user.address && user.address.lat && user.address.lng) {
      latLng.lat = parseFloat(user.address.lat);
      latLng.lng = parseFloat(user.address.lng);
    }
    this.map = await this.googleMapsApi.setMap({map: this.map, mapElement, latLng});
    if (user.address && user.address.lat && user.address.lng) {
      this.setMarker(user, latLng);
    } else {
      this.googleMapsApi.addListenerOnce(this.map, 'click', (event) => {
        this.googleMapsApi.getDirectionData(event.latLng).then((address) => {
          this.patchAddressForm(address);
        }, (fail) => {
          console.log('[account-127]', fail);
        });
        this.setMarker(user, {
          lat: event.latLng.lat(),
          lng: event.latLng.lng()
        });
      });
    }
  }
  /**
   * Establece el marcador segun la ubicacion del usuario en el formulario.
   */
  async getGoogleDirection() {
    const address = this.userForm.value.address;
    if (!(address.street_number && address.route && address.administrative_area_level_1
      && address.administrative_area_level_2 && address.country)) {
      return;
    }
    const latLng = await this.googleMapsApi.getCoords(address);
    this.setMarker(this.userForm.value, latLng);
    this.userForm.patchValue({
      address: {
        lat: latLng.lat,
        lng: latLng.lng,
      }
    });
  }
  /**
   * Establece la pocición del markador del usuario.
   * @param {Usre} user
   * @param {LatLng} latLng
   */
  private async setMarker(user: User, latLng: LatLng) {
    this.userForm.patchValue({
      address: {
        lat: latLng.lat,
        lng: latLng.lng,
      }
    });
    if (!this.marker) {
      const {marker, infoWindow} = await this.googleMapsApi.setMarker({
        content: `<h5>${user.name}</h5>`,
        latLng,
        map: this.map,
        title: user.name
      });
      this.marker = marker;
      this.infoWindow = infoWindow;
      this.googleMapsApi.markerAddListener(this.marker, 'dragend', (markerDrag) => {
        this.userForm.patchValue({
          address: {
            lat: markerDrag.latLng.lat(),
            lng: markerDrag.latLng.lng(),
          }
        });
        this.googleMapsApi.getDirectionData(markerDrag.latLng).then((address) => {
          this.patchAddressForm(address);
        });
      });
    } else {
      this.map.setCenter(latLng);
      this.marker.setPosition(latLng);
      this.infoWindow.setContent(`<h5>${user.name}</h5>`);
    }
  }
  /**
   * Establece la dirección segun la respuesta de google.
   * @param address
   */
  patchAddressForm(address) {
    if (address) {
      this.userForm.patchValue({
        address: {
          country: '',
          administrative_area_level_1: '',
          administrative_area_level_2: '',
          route: '',
          street_number: '',
          postal_code: ''
        }
      });
      address.forEach((element) => {
        element.types.forEach((type: string) => {
          switch (type) {
            case 'route': {
              if (element.long_name !== 'Unnamed Road') {
                this.userForm.patchValue({
                  address: {
                    route: element['long_name']
                  }
                });
              }
            } break;
            case 'street_number': {
              this.userForm.patchValue({
                address: {
                  street_number: element['long_name']
                }
              });
            } break;
            case 'country': {
              this.userForm.patchValue({
                address: {
                  country: element['long_name']
                }
              });
            } break;
            case 'administrative_area_level_2': {
              this.userForm.patchValue({
                address: {
                  administrative_area_level_2: element['long_name']
                }
              });
            } break;
            case 'locality': {
              this.userForm.patchValue({
                address: {
                  administrative_area_level_2: element['long_name']
                }
              });
            } break;
            case 'administrative_area_level_1': {
              this.userForm.patchValue({
                address: {
                  administrative_area_level_1: element['long_name']
                }
              });
            } break;
            case 'country': {
              this.userForm.patchValue({
                address: {
                  country: element['long_name']
                }
              });
            } break;
            case 'postal_code': {
              this.userForm.patchValue({
                address: {
                  postal_code: element['long_name']
                }
              });
            } break;
            default:
              break;
          }
          this.isReadyToUpdate = true;
        });
      });
    }
  }
  /**
   * Actualiza el idioma selecionado por el user.
   */
  setLang(): void {
    if (this.isSelf) {
      this.presentToast(this.translate.instant('UPDATES.LANGUAGE_SUCCESS'));
      this.events.publish('user:lang', this.userForm.value.lang || 'es');
    } else {
      this.api.put(`/user/lang/${this.user.id}`, {lang: this.userForm.value.lang}).then((lang) => {
        this.presentToast(this.translate.instant('UPDATES.LANGUAGE_SUCCESS'));
      }, (fail) => {
        console.log('[account-287]', fail);
      });
    }
  }

  /**
   * Compara dos dirección para verificar que sean diferentes.
   * @param {Address} form
   * @param {Address} stored
   */
  compareAddress(form: Address, stored: Address) {
    return form.administrative_area_level_1 != stored.administrative_area_level_1 ||
    form.administrative_area_level_2 != stored.administrative_area_level_2 ||
    form.country != stored.country ||
    form.lat != stored.lat ||
    form.lng != stored.lng ||
    form.postal_code != stored.postal_code ||
    form.route != stored.route ||
    form.street_number != stored.street_number;
  }

  /**
   * Envía una solicitud al servidor para actualizar la información del user.
   */
  updateUser() {
    if (!this.userForm.valid) { return; }
    this.storage.getUser().then((storage) => {
      if (this.isSelf) {
        if (this.userForm.value.email !== storage.email) {
          this.api.put('/user/email', this.userForm.value).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.EMAIL_SUCCESS'));
            this.storage.setEmail(user.email);
          }, fail => {
            console.log('[user-form-302]', fail);
          });
        }
        if (!storage.address || (this.compareAddress(this.userForm.value.address, storage.address))) {
          this.api.put('/user/address', this.userForm.value.address).then((address: Address) => {
            this.presentToast(this.translate.instant('UPDATES.DIRECTION_SUCCESS'));
            this.storage.setAddress(address);
          }, fail => {
            console.log('[user-form-311]', fail);
          });
        }
        if (this.userForm.value.name !== storage.name) {
          this.api.put('/user', {name: this.userForm.value.name}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.NAME_SUCCESS'));
            this.storage.setName(user.name);
          }, fail => {
            console.log('[user-form-319]', fail);
          });
        }
        if (this.userForm.value.first_name !== storage.first_name) {
          this.api.put('/user', {first_name: this.userForm.value.first_name}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.FIRST_NAME_SUCCESS'));
            this.storage.setFirstName(user.first_name);
          }, fail => {
            console.log('[user-form-327]', fail);
          });
        }
        if (this.userForm.value.last_name !== storage.last_name) {
          this.api.put('/user', {last_name: this.userForm.value.last_name}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.LAST_NAME_SUCCESS'));
            this.storage.setLastName(user.last_name);
          }, fail => {
            console.log('[user-form-335]', fail);
          });
        }
        if (this.userForm.value.gender !== storage.gender) {
          this.api.put('/user', {gender: this.userForm.value.gender}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.GENERO_SUCCESS'));
            this.storage.setGender(user.gender);
          }, fail => {
            console.log('[user-form-343]', fail);
          });
        }
        if (this.userForm.value.phone !== storage.phone) {
          this.api.put('/user', {phone: this.userForm.value.phone}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.PHONE_NUMBER_SUCCESS'));
            this.storage.setPhoneNumber(user.phone);
          }, fail => {
            console.log('[user-form-351]', fail);
          });
        }
        let date = this.userForm.value.birthday;
        date = (date && date.year) ? `${date.year.text}-${date.month.text}-${date.day.text}` : date;
        if (date !== storage.birthday) {
          this.api.put('/user', {birthday: date}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.BIRTHDAY_SUCCESS'));
            this.storage.setBirthday(user.birthday);
          }, fail => {
            console.log('[user-form-361]', fail);
          });
        }
      } else {
        if (this.userForm.value.email !== this.user.email) {
          this.api.put(`/user/email/${this.user.id}`, this.userForm.value).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.EMAIL_SUCCESS'));
            this.user = user;
          }, fail => {
            console.log('[user-form-370]', fail);
          });
        }
        if (!this.user.address || (this.compareAddress(this.userForm.value.address, this.user.address))) {
          this.api.put(`/user/address/${this.user.id}`, this.userForm.value.address).then((address: Address) => {
            this.presentToast(this.translate.instant('UPDATES.DIRECTION_SUCCESS'));
            this.user.address = address;
          }, fail => {
            console.log('[user-form-378]', fail);
          });
        }
        if (this.userForm.value.name !== this.user.name) {
          this.api.put(`/user/${this.user.id}`, {name: this.userForm.value.name}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.NAME_SUCCESS'));
            this.user = user;
          }, fail => {
            console.log('[user-form-386]', fail);
          });
        }
        if (this.userForm.value.first_name !== this.user.first_name) {
          this.api.put(`/user/${this.user.id}`, {first_name: this.userForm.value.first_name}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.FIRST_NAME_SUCCESS'));
            this.user = user;
          }, fail => {
            console.log('[user-form-394]', fail);
          });
        }
        if (this.userForm.value.last_name !== this.user.last_name) {
          this.api.put(`/user/${this.user.id}`, {last_name: this.userForm.value.last_name}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.LAST_NAME_SUCCESS'));
            this.user = user;
          }, fail => {
            console.log('[user-form-402]', fail);
          });
        }
        if (this.userForm.value.gender !== this.user.gender) {
          this.api.put(`/user/${this.user.id}`, {gender: this.userForm.value.gender}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.GENERO_SUCCESS'));
            this.user = user;
          }, fail => {
            console.log('[user-form-410]', fail);
          });
        }
        if (this.userForm.value.phone !== this.user.phone) {
          this.api.put(`/user/${this.user.id}`, {phone: this.userForm.value.phone}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.PHONE_NUMBER_SUCCESS'));
            this.user = user;
          }, fail => {
            console.log('[user-form-418]', fail);
          });
        }
        let date = this.userForm.value.birthday;
        date = (date && date.year) ? `${date.year.text}-${date.month.text}-${date.day.text}` : date;
        if (date !== this.user.birthday) {
          this.api.put(`/user/${this.user.id}`, {birthday: date}).then((user: User) => {
            this.presentToast(this.translate.instant('UPDATES.BIRTHDAY_SUCCESS'));
            this.user = user;
          }, fail => {
            console.log('[user-form-428]', fail);
          });
        }
      }
    });
    this.isReadyToUpdate = false;
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
