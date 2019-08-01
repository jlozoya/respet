import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { ModalBulletinPageModule } from './modal-bulletin/modal-bulletin.module';
import { IonicModule } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../providers/storage/storage.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { Router } from '@angular/router';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BulletinsPage } from './bulletins.page';

describe('BulletinsPage', () => {
  let component: BulletinsPage;
  let fixture: ComponentFixture<BulletinsPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        ModalBulletinPageModule,
        IonicModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ BulletinsPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        StorageService,
        HttpClient,
        HttpHandler,
        TranslateStore,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BulletinsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
