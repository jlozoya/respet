import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../providers/storage/storage.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { BulletinComponent } from './bulletin.component';

describe('BulletinComponent', () => {
  let component: BulletinComponent;
  let fixture: ComponentFixture<BulletinComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ BulletinComponent ],
      providers: [
        HttpClient,
        HttpHandler,
        StorageService,
        TranslateStore,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }},
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BulletinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
