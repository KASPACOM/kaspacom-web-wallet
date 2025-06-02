import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router } from '@angular/router';
import { LOCAL_STORAGE_KEYS } from '../../config/consts';
import { PasswordManagerService } from '../../services/password-manager.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(
    private router: Router,
    private passwordManagerService: PasswordManagerService,
  ) {}

  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    const userData = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA); // replace with your actual key

    if (!userData) {
      return false;
    }
    let isLogged = false;
    try {
      const user = await this.passwordManagerService.getUserData();
      isLogged = true;
    } catch (error) {
      isLogged = false;
    }
    if (!isLogged) {
      this.router.navigate(['/login']);
      return false;
    }
    if (isLogged && route.routeConfig?.path === 'login') {
      this.router.navigate(['/wallet']);
      return false;
    }
    if (isLogged && route.routeConfig?.path === 'onboarding') {
      this.router.navigate(['/wallet']);
      return false;
    }
    return true;

    // if (userData) {
    //   return true; // allow route activation
    // } else {
    //   this.router.navigate(['/login']); // or whatever path you want
    //   return false;
    // }
  }
}
