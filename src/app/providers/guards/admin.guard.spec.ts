import { IonicStorageModule } from '@ionic/storage';
import { StorageService } from './../storage/storage.service';
import { Router } from '@angular/router';
import { TestBed, async, inject } from '@angular/core/testing';

import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        IonicStorageModule.forRoot()
      ],
      providers: [
        AdminGuard,
        StorageService,
        {provide: Router, useClass: class { navigate = jasmine.createSpy('navigate'); }}
      ]
    });
  });

  it('should ...', inject([AdminGuard], (guard: AdminGuard) => {
    expect(guard).toBeTruthy();
  }));
});
