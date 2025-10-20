import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideRouter,
} from '@angular/router';

import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { V2TMP_ROUTES } from '../v2/v2.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(V2TMP_ROUTES),
    // provideRouter(routes, withDebugTracing()),
    provideClientHydration(),
    provideHttpClient(),
    provideAnimationsAsync(),
  ],
};
