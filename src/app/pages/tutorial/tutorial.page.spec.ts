import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../../providers/storage/storage.service';
import { Router } from '@angular/router';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TutorialPage } from './tutorial.page';

describe('TutorialPage', () => {
  let component: TutorialPage;
  let fixture: ComponentFixture<TutorialPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        TranslateModule.forChild(),
        IonicStorageModule.forRoot()
      ],
      declarations: [TutorialPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        TranslateStore,
        StorageService,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TutorialPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
