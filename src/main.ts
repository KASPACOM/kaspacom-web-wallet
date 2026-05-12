import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/core/app.config';
import { AppComponent } from './app/app.component';
import * as kaspa from '../public/kaspa/kaspa';
import * as Sentry from '@sentry/angular';

const APPLICATION_INIT_TIMEOUT = 30000;
const KASPA_WASM_PATH = './kaspa/kaspa_bg.wasm';
const TRANSIENT_WASM_RETRY_DELAY = 750;

const sentryEnvironment =
  window.location.hostname.includes('localhost') ||
  window.location.hostname.includes('local.kaspa') ||
  window.location.hostname.includes('127.0.0.1')
    ? 'development'
    : 'production';
const isProductionEnvironment = sentryEnvironment === 'production';

Sentry.init({
  dsn: 'https://5d158ddfd93e605cbd494bf92522964a@o4510546501959680.ingest.us.sentry.io/4510550518595584',
  environment: sentryEnvironment,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  // Capture unhandled promise rejections
  integrations: [Sentry.browserTracingIntegration()],
  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
});

function getStartupContext() {
  return {
    route: window.location.pathname,
    origin: window.location.origin,
    visibility_state: document.visibilityState,
    online: navigator.onLine,
    user_agent: navigator.userAgent,
    hostname: window.location.hostname,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  return String(err);
}

function isTransientLoadError(err: unknown): boolean {
  const message = getErrorMessage(err).toLowerCase();
  return (
    message.includes('abort') ||
    message.includes('network') ||
    message.includes('load failed') ||
    message.includes('failed to fetch') ||
    message.includes('body loading was aborted')
  );
}

function shouldCaptureStartupError(err: unknown): boolean {
  if (isProductionEnvironment) {
    return true;
  }

  return !isTransientLoadError(err);
}

function captureStartupException(
  err: unknown,
  errorType: string,
  extraContext: Record<string, unknown> = {},
): void {
  if (!shouldCaptureStartupError(err)) {
    console.warn(`[Sentry skipped:${errorType}]`, err);
    return;
  }

  Sentry.captureException(err, {
    tags: { error_type: errorType },
    contexts: {
      startup: {
        ...getStartupContext(),
        ...extraContext,
      },
    },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadKaspaWasm(): Promise<void> {
  try {
    await kaspa.default({ module_or_path: KASPA_WASM_PATH });
  } catch (err) {
    if (!isTransientLoadError(err)) {
      throw err;
    }

    console.warn('Kaspa WASM load failed transiently; retrying once', err);
    await delay(TRANSIENT_WASM_RETRY_DELAY);
    await kaspa.default({ module_or_path: KASPA_WASM_PATH });
  }
}

// Function to show user-friendly error message
function showLoadingError(message: string, technicalDetails?: string) {
  const loader = document.getElementById('application-loader-startup');
  if (loader) {
    const content = loader.querySelector('.loader-content');
    if (content) {
      content.innerHTML = `
        <div style="color: #ff6b6b; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 16px;">⚠️</div>
          <div style="font-size: 1rem; margin-bottom: 8px;">${escapeHtml(message)}</div>
          <div style="font-size: 0.875rem; color: rgba(255,255,255,0.6); margin-bottom: 16px;">
            Please try refreshing the page. If the problem persists, try clearing your browser cache.
          </div>
          ${
            technicalDetails
              ? `<details style="font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-top: 16px;">
            <summary style="cursor: pointer;">Technical details</summary>
            <pre style="text-align: left; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; overflow-x: auto;">${escapeHtml(technicalDetails)}</pre>
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
  captureStartupException(error, 'storage_blocked');
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
      captureStartupException(error, 'initialization_timeout', {
        timeout_duration: APPLICATION_INIT_TIMEOUT,
        wasm_path: KASPA_WASM_PATH,
      });
      showLoadingError(
        'Application is taking longer than expected to load',
        `Timeout: Application failed to initialize within ${APPLICATION_INIT_TIMEOUT / 1000} seconds. This may be due to slow network connection or browser compatibility issues.`,
      );
    }
  }, APPLICATION_INIT_TIMEOUT);

  // Load WASM and bootstrap application with proper error handling
  loadKaspaWasm()
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
          captureStartupException(err, 'bootstrap_failure', {
            error_message: getErrorMessage(err),
          });
          showLoadingError(
            'Failed to start the application',
            `Bootstrap Error: ${getErrorMessage(err)}`,
          );
        });
    })
    .catch((err) => {
      clearTimeout(loadingTimeout);
      console.error('WASM loading failed:', err);
      captureStartupException(err, 'wasm_load_failure', {
        error_message: getErrorMessage(err),
        wasm_path: KASPA_WASM_PATH,
      });
      showLoadingError(
        'Failed to load required application resources',
        `WASM Load Error: ${getErrorMessage(err)}\n\nThis may be caused by:\n- Network connectivity issues\n- Ad blocker or browser extension interference\n- Browser compatibility issues\n- CORS or security policy restrictions`,
      );
    });
}

export class MainModule {}
