import { HttpClient, HttpResponse } from '@angular/common/http';
import { GoogleMapsCircle, GoogleSetMap, GoogleSetMarker, GoogleLatLng } from './../models/google-maps-models';
import { Injectable } from '@angular/core';
import { MapStyle } from '../models/map-style';
import { environment } from './../../../environments/environment';
declare var google: any;

@Injectable({
  providedIn: 'root'
})
export class GoogleMapsApiService {

  constructor(
    private http: HttpClient
  ) {
  }
  /**
   * Establece los parámetros del mapa.
   * @param {GoogleSetMap} options
   */
  public setMap(options: GoogleSetMap): Promise<any> {
    return new Promise((newMap) => {
      if (typeof google !== 'undefined') {
        const styledMapType = new google.maps.StyledMapType(MapStyle);
        options.map = new google.maps.Map(options.mapElement, {
          center: options.latLng,
          zoom: 14,
          mapTypeControlOptions: {
            mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain',
              'styled_map']
          },
          backgroundColor: '#fafafa',
          fullscreenControl: false,
          mapTypeControl: false
        });
        options.map.mapTypes.set('styled_map', styledMapType);
        options.map.setMapTypeId('styled_map');
        google.maps.event.addListenerOnce(options.map, 'idle', () => {
          options.mapElement.classList.add('show-map');
        });
        newMap(options.map);
      }
    });
  }
  /**
   * Agrega un circulo al mapa.
   * @param {GoogleMapsCircle} options
   */
  public addCircle(options: GoogleMapsCircle) {
    return new google.maps.Circle({
      strokeColor: options.strokeColor || '#FF0000',
      strokeOpacity: options.strokeOpacity || 0.8,
      strokeWeight: options.strokeWeight || 2,
      fillColor: options.fillColor || '#FF0000',
      fillOpacity: options.fillOpacity || 0.35,
      radius: options.radius || 1,
      map: options.map,
      center: options.center
    });
  }
  /**
   * Agrega un evento a un mapa.
   * @param localMap
   * @param event
   * @param callback
   */
  public addListenerOnce(localMap: any, event: any, callback: Function) {
    google.maps.event.addListenerOnce(localMap, event, callback);
  }
  /**
   * Agrega un evento a un marcador.
   * @param marker
   * @param event
   * @param callback
   */
  public markerAddListener(marker: any, event: any, callback: Function) {
    marker.addListener(event, callback);
  }
  /**
   * Establece el marcador en el mapa.
   * @param {GoogleSetMarker} options
   */
  public setMarker(options: GoogleSetMarker): Promise<any> {
    return new Promise((newMarker) => {
      const infoWindow = new google.maps.InfoWindow({
        content: options.content
      });
      const marker = new google.maps.Marker({
        position: options.latLng,
        map: options.map,
        title: options.title,
        draggable: (typeof options.draggable !== 'undefined') ? options.draggable : true
      });
      marker.addListener('click', () => {
        infoWindow.open(options.map, marker);
      });
      newMarker({marker, infoWindow});
    });
  }
  /**
   * Establece el marcador de la dirección escrita en los campos anteriores.
   * @param direction
   */
  public getCoords(direction): Promise<any> {
    return new Promise((coords) => {
      const serach = `${direction.street_number} ${direction.route}, ${
        direction.administrative_area_level_1
      }, ${
        direction.administrative_area_level_2
      }, ${direction.country}`.trim().replace(' ', '+');
      this.http.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${serach}&key=${environment.GOOGLE_MAPS_API_KEY}`)
      .subscribe((response: any) => {
        if (typeof google !== 'undefined') {
          if (response.results.length > 0) {
            coords(response.results[0].geometry.location);
          } else {
            coords({});
          }
        }
      });
    });
  }

  /**
   * Consulta la información de la ubicación selecionada, en español y la agrega a su campo
   * correspondiente en el formulario.
   */
  public getDirectionData(latLng: GoogleLatLng): Promise<any> {
    return new Promise((result, error) => {
      this.http.post(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latLng.lat()},${latLng.lng()}&key=${environment.GOOGLE_MAPS_API_KEY}`, '')
      .subscribe((data: any) => {
        if (data.status == 'OK') {
          result(data['results'][0]['address_components']);
        } else {
          error('Esta haciendo clic en el mar');
        }
      }, (fail) => {
        error(fail);
      });
    });
  }
}

