import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  provideRouter,
  withDebugTracing,
  withRouterConfig,
} from '@angular/router';

// import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { V2TMP_ROUTES } from '../v2/v2.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(V2TMP_ROUTES, withDebugTracing()),
    provideClientHydration(),
    provideHttpClient(),
    provideAnimationsAsync(),
  ],
};
