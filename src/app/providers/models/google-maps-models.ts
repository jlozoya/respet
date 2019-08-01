export interface GoogleMapsCircle {
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  fillColor?: string;
  fillOpacity?: number;
  map: any;
  center: LatLng;
  radius?: number;
}

export interface GoogleSetMarker {
  map: any;
  latLng: LatLng;
  content: string;
  title: string;
  draggable?: boolean;
}

export interface GoogleSetMap {
  map: any;
  mapElement: any;
  latLng: LatLng;
}

export interface GoogleLatLng {
  lat(): number;
  lng(): number;
}

export interface LatLng {
  lat?: number;
  lng?: number;
}
