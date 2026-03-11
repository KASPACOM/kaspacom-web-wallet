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
import { V2TMP_ROUTES } from '../v2/v2.routes';
import { environment } from '../../environments/environment';
import { DEFI_API_BASE_URL, LOGOS_URL } from '../config/injection-tokens';

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
      useValue: environment.kaspaComDefiApiBaseurl,
    },
    {
      provide: LOGOS_URL,
      useValue: environment.logosUrl,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: () => () => {},
      deps: [Sentry.TraceService],
      multi: true,
    },
  ],
};
