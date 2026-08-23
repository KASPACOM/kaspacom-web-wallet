import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LOCAL_STORAGE_KEYS } from '../config/consts';
import { IFrameCommunicationApp } from '../services/communication-service/communication-app/iframe-communication.service';

export const publicHomeGuard: CanActivateFn = (route) => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const router = inject(Router);

  if (IFrameCommunicationApp.isIframe()) {
    return true;
  }

  const hasWalletData = !!localStorage.getItem(LOCAL_STORAGE_KEYS.USER_DATA);

  if (hasWalletData && !route.queryParamMap.has('iframeInfo')) {
    return router.createUrlTree(['/onboarding'], {
      queryParams: route.queryParams,
      fragment: route.fragment ?? undefined,
    });
  }

  if (route.queryParamMap.has('walletInfo')) {
    return true;
  }

  return true;
};
