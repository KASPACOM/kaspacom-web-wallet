import { Page } from '@playwright/test';

/**
 * Wipe wallet state so each test starts at the true onboarding landing.
 * Clears localStorage (encrypted userData lives here) and Dexie DBs.
 */
export async function clearWalletState(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* noop */
    }
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      await Promise.all(
        dbs
          .filter((db) => !!db.name)
          .map(
            (db) =>
              new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(db.name!);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              }),
          ),
      );
    }
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
}

/**
 * Has encrypted userData been persisted? (true after successful onboarding)
 */
export async function hasStoredWallet(page: Page): Promise<boolean> {
  return page.evaluate(() => localStorage.getItem('userData') !== null);
}
