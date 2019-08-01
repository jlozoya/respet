import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../../providers/storage/storage.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslatePipeMock } from './../../../../../__mocks__/translate-pipe.mock';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UserCardComponent } from './user-card.component';

describe('UserCardComponent', () => {
  let component: UserCardComponent;
  let fixture: ComponentFixture<UserCardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        CommonModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ TranslatePipeMock, UserCardComponent ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        HttpClient,
        HttpHandler,
        StorageService,
        TranslateStore,
        {provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
