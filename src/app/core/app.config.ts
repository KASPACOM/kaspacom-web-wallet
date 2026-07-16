import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import * as Sentry from '@sentry/angular';

import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { OVERLAY_DEFAULT_CONFIG } from '@angular/cdk/overlay';
import { V2TMP_ROUTES } from '../v2/v2.routes';
import { environment } from '../../environments/environment';
import { DEFI_API_BASE_URL, LOGOS_URL } from '../config/injection-tokens';

const defaultL1Network =
  environment.l1Config.networks?.find(
    (network) => network.network === environment.kaspaNetwork,
  ) ?? environment.l1Config.networks?.[0];

if (!defaultL1Network) {
  throw new Error(
    'No Kaspa L1 networks configured. Check environment.l1Config.networks.',
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(V2TMP_ROUTES),
    // provideRouter(routes, withDebugTracing()),
    provideClientHydration(),
    provideHttpClient(),
    provideAnimationsAsync(),
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler(),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    {
      provide: DEFI_API_BASE_URL,
      useValue: defaultL1Network.kaspaComDefiApiBaseurl,
    },
    {
      provide: LOGOS_URL,
      useValue: environment.logosUrl,
    },
    {
      // CDK overlays (dialogs, dropdowns) default to the native Popover API,
      // which renders them in the browser's top layer — above every other
      // element regardless of z-index. That makes it impossible for our
      // kc-snackbar notifications to appear above an open dialog. Disable it
      // so overlays stack via normal CSS z-index instead.
      provide: OVERLAY_DEFAULT_CONFIG,
      useValue: { usePopover: false },
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ],
};
