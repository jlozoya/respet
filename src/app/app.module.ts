import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { SplashScreen } from '@ionic-native/splash-screen/ngx';
import { StatusBar } from '@ionic-native/status-bar/ngx';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { HttpClient, HttpClientModule } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { IonicStorageModule } from '@ionic/storage-angular';
import { Facebook } from '@ionic-native/facebook/ngx';
import { GooglePlus } from '@ionic-native/google-plus/ngx';

import { File } from '@ionic-native/file/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { Camera } from '@ionic-native/camera/ngx';
import { Crop } from '@ionic-native/crop/ngx';

import { SocialSharing } from '@ionic-native/social-sharing/ngx';

import { ApiService, StorageService, TransferImgFileService,
  SocialLoginService, GoogleMapsApiService } from './providers/providers';
import { ValidationService } from './shared/directives/validation.service';

// El cargador de traducción necesita saber dónde cargar los archivos i18n
// en Ionic static asset pipeline.
export function createTranslateLoader() {
  return new TranslateHttpLoader();
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: (createTranslateLoader),
        deps: []
      }
    }),
    IonicModule.forRoot(),
    IonicStorageModule.forRoot(),
    AppRoutingModule
  ],
  providers: [
    ApiService,
    Camera,
    Facebook,
    GooglePlus,
    SplashScreen,
    StatusBar,
    StorageService,
    ValidationService,
    File,
    Camera,
    FilePath,
    Crop,
    SocialLoginService,
    TransferImgFileService,
    GoogleMapsApiService,
    SocialSharing,
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
