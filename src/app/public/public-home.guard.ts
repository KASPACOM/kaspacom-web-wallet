import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { LOCAL_STORAGE_KEYS } from '../config/consts';
import { IFrameCommunicationApp } from '../services/communication-service/communication-app/iframe-communication.service';

export const publicHomeGuard: CanMatchFn = () => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const searchParams = new URLSearchParams(window.location.search);

  if (searchParams.has('walletInfo')) {
    return true;
  }

  if (IFrameCommunicationApp.isIframe()) {
    return false;
  }

  const hasWalletData = !!localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);
  return !hasWalletData;
};
