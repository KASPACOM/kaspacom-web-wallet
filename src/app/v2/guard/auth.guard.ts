import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
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
  // todo this is temp, clean this up when im sure about the flow
  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Promise<boolean> {
    const userData = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA); // replace with your actual key

    const fullPath = state.url;

    if (!userData) {
      if (fullPath === '/onboarding') {
        return true;
      } else {
        this.router.navigate(['/onboarding']);
        return false;
      }
    }
    let isLogged = false;
    try {
      const user = await this.passwordManagerService.getUserData();
      isLogged = true;
    } catch (error) {
      isLogged = false;
    }
    if (!isLogged && fullPath !== '/app/login') {
      this.router.navigate(['/app/login']);
      return false;
    }
    if (isLogged && fullPath === '/app/login') {
      this.router.navigate(['/app/home']);
      return false;
    }
    if (isLogged && fullPath === 'onboarding') {
      this.router.navigate(['/app/home']);
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
