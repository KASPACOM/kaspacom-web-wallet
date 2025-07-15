import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AccountSettingsService {
  private isOpenSignal = signal(false);
  
  get isOpen() {
    return this.isOpenSignal.asReadonly();
  }
  
  open() {
    this.isOpenSignal.set(true);
  }
  
  close() {
    this.isOpenSignal.set(false);
  }
  
  toggle() {
    this.isOpenSignal.update(value => !value);
  }
} 