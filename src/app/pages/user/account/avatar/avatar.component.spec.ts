import { Router } from '@angular/router';
import { StorageService } from './../../../../providers/storage/storage.service';
import { TranslateService, TranslateStore, TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { FilePath } from '@ionic-native/file-path/ngx';
import { File } from '@ionic-native/file/ngx';
import { Camera } from '@ionic-native/camera/ngx';
import { TransferImgFileService } from './../../../../providers/transfer/transfer-img-file.service';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarComponent } from './avatar.component';
import { IonicStorageModule } from '@ionic/storage';

describe('AvatarComponent', () => {
  let component: AvatarComponent;
  let fixture: ComponentFixture<AvatarComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        TranslateModule.forRoot(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ AvatarComponent ],
      providers: [
        Camera,
        File,
        FilePath,
        HttpClient,
        HttpHandler,
        TranslateService,
        TranslateStore,
        StorageService,
        TransferImgFileService,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AvatarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
