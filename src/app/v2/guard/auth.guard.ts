import { Injectable, inject } from '@angular/core';
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
  private router = inject(Router);
  private passwordManagerService = inject(PasswordManagerService);

  // todo this is temp, clean this up when im sure about the flow
  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Promise<boolean> {
    const userData = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA); // replace with your actual key

    const fullPath = state.url;

    const onboardingPaths = ['/onboarding', '/onboarding-v2'];

    if (!userData) {
      if (onboardingPaths.includes(fullPath)) {
        return true;
      }

      this.router.navigate(['/onboarding']);
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
      if (onboardingPaths.includes(fullPath)) {
        return true;
      }

      this.router.navigate(['/onboarding']);
      return false;
    }

    if (isLogged && onboardingPaths.includes(fullPath)) {
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
