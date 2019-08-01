import { Router, ActivatedRoute, Params } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../../providers/storage/storage.service';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountPage } from './account.page';

describe('AccountPage', () => {
  let component: AccountPage;
  let fixture: ComponentFixture<AccountPage>;
  const fakeActivatedRoute = {
    params: {
      subscribe: (fn: (value: Params) => void) => fn({
        user_id: 1,
      }),
    },
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot(),
      ],
      declarations: [AccountPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        HttpClient,
        HttpHandler,
        StorageService,
        TranslateStore,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }},
        { provide: ActivatedRoute, useValue: fakeActivatedRoute }
      ]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AccountPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
