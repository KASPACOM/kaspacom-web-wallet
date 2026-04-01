import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/core/app.config';
import { AppComponent } from './app/app.component';
import * as kaspa from '../public/kaspa/kaspa';
import * as Sentry from '@sentry/angular';

const APPLICATION_INIT_TIMEOUT = 30000;

Sentry.init({
  dsn: 'https://5d158ddfd93e605cbd494bf92522964a@o4510546501959680.ingest.us.sentry.io/4510550518595584',
  environment:
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('local.kaspa') ||
    window.location.hostname.includes('127.0.0.1')
      ? 'development'
      : 'production',
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  // Capture unhandled promise rejections
  integrations: [Sentry.browserTracingIntegration()],
  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
});

// Function to show user-friendly error message
function showLoadingError(message: string, technicalDetails?: string) {
  const loader = document.getElementById('application-loader-startup');
  if (loader) {
    const content = loader.querySelector('.loader-content');
    if (content) {
      content.innerHTML = `
        <div style="color: #ff6b6b; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 16px;">⚠️</div>
          <div style="font-size: 1rem; margin-bottom: 8px;">${message}</div>
          <div style="font-size: 0.875rem; color: rgba(255,255,255,0.6); margin-bottom: 16px;">
            Please try refreshing the page. If the problem persists, try clearing your browser cache.
          </div>
          ${
            technicalDetails
              ? `<details style="font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-top: 16px;">
            <summary style="cursor: pointer;">Technical details</summary>
            <pre style="text-align: left; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow-x: auto;">${technicalDetails}</pre>
          </details>`
              : ''
          }
        </div>
      `;
    }
  }
  console.error('[Loading Error]', message, technicalDetails);
}

// Check if storage is available (catches privacy settings blocking IndexedDB)
function checkStorageAvailability(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// In cross-origin iframes on iOS Safari, localStorage is blocked until
// document.requestStorageAccess() is called with a user gesture. If storage
// is unavailable, show a button the user can tap to grant access.
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function showStorageAccessPrompt(): void {
  const loader = document.getElementById('application-loader-startup');
  if (!loader) return;
  const content = loader.querySelector('.loader-content');
  if (!content) return;

  content.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 1rem; margin-bottom: 16px; color: #fff;">
        This wallet needs storage access to function.
      </div>
      <button id="grant-storage-btn" style="
        padding: 12px 32px;
        font-size: 1rem;
        background: #6fc7ba;
        color: #000;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
      ">Tap to enable</button>
    </div>
  `;

  document.getElementById('grant-storage-btn')?.addEventListener('click', async (e) => {
    const btn = e.target as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Enabling...';
    try {
      if (document.requestStorageAccess) {
        await document.requestStorageAccess();
      }
      if (checkStorageAvailability()) {
        initApp();
      } else {
        showLoadingError(
          'Storage access is still blocked',
          'Please check your browser privacy settings.',
        );
      }
    } catch {
      showLoadingError(
        'Storage access was denied',
        'Please check your browser privacy settings.',
      );
    }
  });
}

// Main entry point
let appInitialized = false;
if (checkStorageAvailability()) {
  initApp();
} else if (isInIframe() && typeof document.requestStorageAccess === 'function') {
  // In iframe with storage blocked — show prompt for user gesture
  showStorageAccessPrompt();
} else {
  // Not in iframe or no Storage Access API — fail with error
  const error = new Error('Storage access blocked');
  Sentry.captureException(error, {
    tags: { error_type: 'storage_blocked' },
    contexts: {
      browser: {
        userAgent: navigator.userAgent,
        hostname: window.location.hostname,
      },
    },
  });
  showLoadingError(
    'Storage access is blocked',
    'This application requires storage access to function. Please check your browser privacy settings:\n\n' +
      '• Safari: Settings → Privacy → Disable "Prevent Cross-Site Tracking" for this site\n' +
      '• Firefox: Settings → Privacy → Standard mode (not Strict)\n' +
      '• Chrome: Settings → Privacy → Allow third-party cookies\n' +
      '• If using Private/Incognito mode, try regular browsing mode',
  );
}

function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  // Timeout fallback - if app doesn't start within expected time, show error
  const loadingTimeout = setTimeout(() => {
    const loader = document.getElementById('application-loader-startup');
    if (loader && !loader.classList.contains('fade-out')) {
      const error = new Error(`Application initialization timeout (${APPLICATION_INIT_TIMEOUT / 1000}s)`);
      Sentry.captureException(error, {
        tags: { error_type: 'initialization_timeout' },
        contexts: {
          timing: {
            timeout_duration: APPLICATION_INIT_TIMEOUT,
          },
          browser: {
            userAgent: navigator.userAgent,
            hostname: window.location.hostname,
          },
        },
      });
      showLoadingError(
        'Application is taking longer than expected to load',
        `Timeout: Application failed to initialize within ${APPLICATION_INIT_TIMEOUT / 1000} seconds. This may be due to slow network connection or browser compatibility issues.`,
      );
    }
  }, APPLICATION_INIT_TIMEOUT);

  // Load WASM and bootstrap application with proper error handling
  kaspa
    .default({ module_or_path: './kaspa/kaspa_bg.wasm' })
    .then(() => {
      kaspa.initWASM32Bindings({ validateClassNames: false });
      bootstrapApplication(AppComponent, appConfig)
        .then(() => {
          // Successfully bootstrapped - clear timeout
          clearTimeout(loadingTimeout);
        })
        .catch((err) => {
          clearTimeout(loadingTimeout);
          console.error('Angular bootstrap failed:', err);
          Sentry.captureException(err, {
            tags: { error_type: 'bootstrap_failure' },
            contexts: {
              bootstrap: {
                error_message: err?.message || String(err),
              },
            },
          });
          showLoadingError(
            'Failed to start the application',
            `Bootstrap Error: ${err?.message || err}`,
          );
        });
    })
    .catch((err) => {
      clearTimeout(loadingTimeout);
      console.error('WASM loading failed:', err);
      Sentry.captureException(err, {
        tags: { error_type: 'wasm_load_failure' },
        contexts: {
          wasm: {
            error_message: err?.message || String(err),
            wasm_path: './kaspa/kaspa_bg.wasm',
          },
          browser: {
            userAgent: navigator.userAgent,
          },
        },
      });
      showLoadingError(
        'Failed to load required application resources',
        `WASM Load Error: ${err?.message || err}\n\nThis may be caused by:\n- Network connectivity issues\n- Ad blocker or browser extension interference\n- Browser compatibility issues\n- CORS or security policy restrictions`,
      );
    });
}

export class MainModule {}
