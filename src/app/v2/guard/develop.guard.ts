import { Injectable } from '@angular/core';
import {
  CanActivate,
} from '@angular/router';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DevelopGuard implements CanActivate {
  constructor(
  ) {}
  // todo this is temp, clean this up when im sure about the flow
  async canActivate(
  ): Promise<boolean> {
    return !environment.isProduction;

    // if (userData) {
    //   return true; // allow route activation
    // } else {
    //   this.router.navigate(['/login']); // or whatever path you want
    //   return false;
    // }
  }
}
