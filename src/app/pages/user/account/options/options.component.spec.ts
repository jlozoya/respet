import { GooglePlus } from '@ionic-native/google-plus/ngx';
import { Facebook } from '@ionic-native/facebook/ngx';
import { FacebookService } from 'ngx-facebook';
import { SocialLoginService, StorageService } from './../../../../providers/providers';
import { Router } from '@angular/router';
import { IonicStorageModule } from '@ionic/storage';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OptionsComponent } from './options.component';
import { IonicModule } from '@ionic/angular';

describe('OptionsComponent', () => {
  let component: OptionsComponent;
  let fixture: ComponentFixture<OptionsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        FormsModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot(),
      ],
      declarations: [ OptionsComponent ],
      providers: [
        HttpClient,
        HttpHandler,
        TranslateStore,
        StorageService,
        SocialLoginService,
        FacebookService,
        Facebook,
        GooglePlus,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
