import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../storage/storage.service';
import { Router } from '@angular/router';
import { TestBed, async, inject } from '@angular/core/testing';

import { SesionGuard } from './sesion.guard';

describe('SesionGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicStorageModule.forRoot()
      ],
      providers: [
        SesionGuard,
        StorageService,
        {provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    });
  });

  it('should ...', inject([SesionGuard], (guard: SesionGuard) => {
    expect(guard).toBeTruthy();
  }));
});
