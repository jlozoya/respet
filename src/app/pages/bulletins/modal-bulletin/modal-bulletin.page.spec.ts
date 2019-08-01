import { FilePath } from '@ionic-native/file-path/ngx';
import { File } from '@ionic-native/file/ngx';
import { Camera } from '@ionic-native/camera/ngx';
import { TransferImgFileService } from './../../../providers/transfer/transfer-img-file.service';
import { Router } from '@angular/router';
import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../../providers/storage/storage.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule, NavParams } from '@ionic/angular';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalBulletinPage } from './modal-bulletin.page';

describe('ModalBulletinPage', () => {
  let component: ModalBulletinPage;
  let fixture: ComponentFixture<ModalBulletinPage>;
  class MockNavParams {
    data = {
      user: {
        bulletin_id: '1',
      }
    };
    get(param) {
      return this.data[param];
    }
  }
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ ModalBulletinPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        Camera,
        File,
        FilePath,
        StorageService,
        HttpClient,
        HttpHandler,
        TransferImgFileService,
        TranslateStore,
        { provide: NavParams, useClass: MockNavParams },
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ModalBulletinPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
