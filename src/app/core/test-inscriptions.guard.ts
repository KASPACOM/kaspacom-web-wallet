import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { PasswordManagerService } from '../services/password-manager.service';

@Injectable({
  providedIn: 'root'
})
export class TestInscriptionsGuard implements CanActivate {
  constructor(
    private router: Router,
    private passwordManagerService: PasswordManagerService
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    // Allow test-inscriptions route
    if (route.routeConfig?.path === 'test-inscriptions') {
      return true;
    }

    // For other routes, check authentication
    if (this.passwordManagerService.isUserHasSavedPassword()) {
      this.router.navigate(['/login']);
    } else {
      this.router.navigate(['/set-password']);
    }
    return false;
  }
}
