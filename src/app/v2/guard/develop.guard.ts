import { Injectable } from '@angular/core';
import { CanActivate } from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DevelopGuard implements CanActivate {
  canActivate(): boolean {
    return !environment.isProduction;
  }
}
