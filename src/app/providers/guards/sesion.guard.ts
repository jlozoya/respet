import { StorageService } from './../storage/storage.service';
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SesionGuard implements CanActivate {

  constructor(
    private router: Router,
    private storage: StorageService
  ) { }
  /**
   * Evalúa la sesión del usuario regresa un booleano según corresponda.
   * @param {ActivatedRouteSnapshot} next
   * @param {RouterStateSnapshot} state
   */
  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {
    return this.storage.getId().then(userId => {
      if (userId) {
        return true;
      }
      this.router.navigate(['./login']);
      return false;
    });
  }
}
