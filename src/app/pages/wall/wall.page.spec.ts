import { Router, ActivatedRoute } from '@angular/router';
import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../providers/storage/storage.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WallPage } from './wall.page';

describe('WallPage', () => {
  let component: WallPage;
  let fixture: ComponentFixture<WallPage>;
  const fakeActivatedRoute = {
    snapshot: { data: { user_id: 1 } }
  };

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
      declarations: [ WallPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        HttpClient,
        HttpHandler,
        StorageService,
        { provide: ActivatedRoute, useValue: fakeActivatedRoute },
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WallPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
