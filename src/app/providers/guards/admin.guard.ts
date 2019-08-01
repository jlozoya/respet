import { StorageService } from '../storage/storage.service';
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private router: Router,
    private userData: StorageService
  ) { }
  /**
   * Evalúa si la sesión del usuario es de un adiministrador.
   *
   * No hay problema con evaluarlo del lado del cliente, porque
   * se realiza la evaluación del lado del servidor también.
   *
   * @param {ActivatedRouteSnapshot} next
   * @param {RouterStateSnapshot} state
   */
  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {
    return this.userData.getUserRole().then(role => {
      if (role === 'admin') {
        return true;
      }
      this.router.navigate(['./login']);
      return false;
    });
  }
}
