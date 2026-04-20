import { test, expect } from '@playwright/test';

/**
 * Iframe-embed coverage. The wallet is designed to render inside a host
 * site (DeFi app, marketplace) via <iframe src="/"/> — PR #185 was a
 * regression in that embed on Safari / Firefox / mobile 100dvh.
 *
 * We can't use the dev-server webServer directly because Playwright would
 * navigate to it as the top frame. Instead, set a same-origin parent
 * document via addInitScript + serve a tiny HTML shim that embeds the
 * wallet in an iframe. That way `window.self !== window.top` evaluates
 * true in the wallet — the branch the IframeAccountSelection flow uses.
 */

const IFRAME_HOST_PATH = '/__e2e_iframe_host__';

async function routeIframeHost(page: import('@playwright/test').Page, baseURL: string) {
  const target = new URL('/', baseURL).toString();
  await page.route(`${baseURL}${IFRAME_HOST_PATH}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <style>
      html,body{margin:0;padding:0;height:100dvh;overflow:hidden}
      iframe{display:block;width:100%;height:100dvh;border:0}
    </style>
    <title>E2E iframe host</title>
  </head>
  <body>
    <iframe id="wallet" src="${target}"></iframe>
  </body>
</html>`,
    });
  });
}

test.describe('Iframe embed', () => {
  test('@smoke iframe-embedded landing renders Create + Connect buttons', async ({
    page,
    baseURL,
  }) => {
    await routeIframeHost(page, baseURL!);
    await page.goto(IFRAME_HOST_PATH);

    const wallet = page.frameLocator('#wallet');
    await expect(
      wallet.locator('kc-button', { hasText: 'Create New Wallet' }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      wallet.locator('kc-button', { hasText: 'Connect Existing Wallet' }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('iframe fills the host viewport without overflow', async ({
    page,
    baseURL,
  }, testInfo) => {
    await routeIframeHost(page, baseURL!);
    await page.goto(IFRAME_HOST_PATH);

    // Wait for the iframe to paint its first Angular component.
    const wallet = page.frameLocator('#wallet');
    await expect(
      wallet.locator('kc-button', { hasText: 'Create New Wallet' }).first(),
    ).toBeVisible({ timeout: 30_000 });

    const box = await page.locator('#wallet').boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (!box || !viewport) return;

    // The iframe must not extend beyond the viewport (PR #185's 100dvh bug
    // manifested as the iframe being taller than the host, causing scroll).
    expect(box.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(box.width).toBeLessThanOrEqual(viewport.width + 1);

    // Host document must not have a scrollable body (overflow hidden + the
    // iframe == viewport).
    const bodyScrollHeight = await page.evaluate(
      () => document.body.scrollHeight,
    );
    expect(bodyScrollHeight).toBeLessThanOrEqual(viewport.height + 1);

    testInfo.annotations.push({
      type: 'iframe-box',
      description: `${box.width}x${box.height} in ${viewport.width}x${viewport.height}`,
    });
  });
});
