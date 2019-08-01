import { Router } from '@angular/router';
import { StorageService } from './../../providers/storage/storage.service';
import { HttpClient, HttpHandler } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterComponent } from './footer.component';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/shared/shared.module';
import { IonicStorageModule } from '@ionic/storage';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        ReactiveFormsModule,
        SharedModule,
        TranslateModule.forRoot(),
        IonicStorageModule.forRoot()
      ],
      declarations: [ FooterComponent ],
      providers: [
        StorageService,
        HttpClient,
        HttpHandler,
        { provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
