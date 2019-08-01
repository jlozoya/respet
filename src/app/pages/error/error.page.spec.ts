import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ErrorPage } from './error.page';

describe('ErrorPage', () => {
  let component: ErrorPage;
  let fixture: ComponentFixture<ErrorPage>;
  const fakeActivatedRoute = {
    snapshot: { data: {}}
  } as ActivatedRoute;
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        TranslateModule.forChild()
      ],
      declarations: [ ErrorPage ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        TranslateStore,
        { provide: ActivatedRoute, useValue: fakeActivatedRoute},
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ],
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ErrorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
