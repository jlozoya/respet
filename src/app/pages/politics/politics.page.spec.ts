import { ActivatedRoute, Params } from '@angular/router';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PoliticsPage } from './politics.page';

describe('PoliticsPage', () => {
  let component: PoliticsPage;
  let fixture: ComponentFixture<PoliticsPage>;
  const fakeActivatedRoute = {
    params: {
      subscribe: (fn: (value: Params) => void) => fn({
        segment: 'end_user_agreement',
      }),
    },
  };
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        TranslateModule.forChild()
      ],
      declarations: [PoliticsPage],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        TranslateStore,
        { provide: ActivatedRoute, useValue: fakeActivatedRoute }
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PoliticsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
