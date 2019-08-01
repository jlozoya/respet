import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { IonicModule, NavParams } from '@ionic/angular';
import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ImgModalComponent } from './img-modal.component';

describe('ImgModalComponent', () => {
  let component: ImgModalComponent;
  let fixture: ComponentFixture<ImgModalComponent>;
  class MockNavParams {
    data = {
      imgs: [],
      position: 0,
      source: '',
      source_id: 1
    };
    get(param) {
      return this.data[param];
    }
  }
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicModule,
        CommonModule,
        FormsModule,
        TranslateModule.forChild()
      ],
      declarations: [ ImgModalComponent ],
      providers: [
        { provide: NavParams, useClass: MockNavParams },
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ImgModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
