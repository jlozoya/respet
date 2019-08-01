import { Router } from '@angular/router';
import { StorageService } from './../../../providers/storage/storage.service';
import { IonicStorageModule } from '@ionic/storage';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PrivacyPage } from './privacy.page';
import { IonicModule } from '@ionic/angular';

describe('PrivacyPage', () => {
  let component: PrivacyPage;
  let fixture: ComponentFixture<PrivacyPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ PrivacyPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        HttpClient,
        HttpHandler,
        TranslateStore,
        StorageService,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PrivacyPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
