import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Ubication, MapStyle } from '../../providers/providers';
declare var google: any;

@Component({
  selector: 'app-about',
  templateUrl: 'about.page.html',
  styleUrls: ['about.page.scss']
})
export class AboutPage implements AfterViewInit {

  map;
  @ViewChild('mapCanvas', {static: false}) mapElement: ElementRef;

  ubications: Ubication[] = [
    {
      name: 'ResPet',
      direction: {
        route: 'Victoria',
        street_number: '343',
        postal_code: 34000,
        administrative_area_level_1: 'Durango',
        administrative_area_level_2: 'Durango',
        country: 'México',
      },
      latLng: {lat: 24.0306214, lng: -104.67007960000001}
    }
  ];

  constructor(
  ) {
  }

  ngAfterViewInit() {
    if (typeof google !== 'undefined') {
      this.setMapa();
    }
  }
  /**
   * Establece los parámetros del mapa.
   */
  setMapa(): void {
    const mapEle = this.mapElement.nativeElement;
    const styledMapType = new google.maps.StyledMapType(MapStyle);
    this.map = new google.maps.Map(mapEle, {
      center: this.ubications[0].latLng,
      zoom: 14,
      mapTypeControlOptions: {
        mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain',
          'styled_map']
      },
      backgroundColor: '#fafafa',
      fullscreenControl: false,
      mapTypeControl: false
    });
    this.map.mapTypes.set('styled_map', styledMapType);
    this.map.setMapTypeId('styled_map');
    google.maps.event.addListenerOnce(this.map, 'idle', () => {
      mapEle.classList.add('show-map');
    });
    this.ubications.forEach(ubication => {
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="color: #27272f;">
        <h6>${ubication.name}</h6>
        <p>${ubication.direction.route} ${ubication.direction.street_number}</p>
        <p>${ubication.direction.postal_code} ${ubication.direction.administrative_area_level_1}, ${ubication.direction.administrative_area_level_2}</p>
        <p>${ubication.direction.country}</p></div>`
      });
      const marker = new google.maps.Marker({
        position: ubication.latLng,
        map: this.map,
        title: ubication.name,
        draggable: false
      });
      marker.addListener('click', () => {
        infoWindow.open(this.map, marker);
      });
    });
  }
}
