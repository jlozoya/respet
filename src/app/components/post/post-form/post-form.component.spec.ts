import { of } from 'rxjs';
import { TransferImgFileService } from './../../../providers/transfer/transfer-img-file.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../../providers/storage/storage.service';
import { Router, NavigationEnd } from '@angular/router';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { Camera } from '@ionic-native/camera/ngx';
import { File } from '@ionic-native/file/ngx';
import { FilePath } from '@ionic-native/file-path/ngx';
import { PostFormComponent } from './post-form.component';
import { SharedModule } from 'src/app/shared/shared.module';

describe('PostFormComponent', () => {
  let component: PostFormComponent;
  let fixture: ComponentFixture<PostFormComponent>;
  class MockServices {
    // Router
    public events = of( new NavigationEnd(0, 'http://localhost:4200/login', 'http://localhost:4200/login'));
  }
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        SharedModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ PostFormComponent ],
      providers: [
        File,
        FilePath,
        Camera,
        HttpClient,
        HttpHandler,
        StorageService,
        TranslateStore,
        TransferImgFileService,
        { provide: Router, useClass: MockServices }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PostFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
