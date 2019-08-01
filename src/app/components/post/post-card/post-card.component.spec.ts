import { FacebookService } from 'ngx-facebook';
import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../../providers/storage/storage.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { SocialSharing } from '@ionic-native/social-sharing/ngx';
import { Router } from '@angular/router';
import { GalleryComponent } from './../../gallery/gallery.component';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PostCardComponent } from './post-card.component';
import { IonicModule } from '@ionic/angular';

describe('PostCardComponent', () => {
  let component: PostCardComponent;
  let fixture: ComponentFixture<PostCardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        CommonModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ PostCardComponent, GalleryComponent ],
      providers: [
        HttpClient,
        HttpHandler,
        SocialSharing,
        TranslateStore,
        StorageService,
        FacebookService,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PostCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
