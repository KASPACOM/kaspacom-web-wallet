# Wallet Public SEO Deployment

## Dev first

Apply this to `dev-wallet.kaspa.com` before production.

## S3 website config

Use:

- `IndexDocument`: `index.html`
- `ErrorDocument`: `404.html`

Do not use `index.html` as the error document. That returns the Angular shell with a `404` status for deep links and creates crawl problems.

## CloudFront viewer-request rewrite

Attach a viewer-request function before testing dev.

Rules:

- Requests with a file extension pass through unchanged.
- `/` maps to `/index.html`.
- Trailing slash public URLs, for example `/faq/`, normalize before matching.
- Known public routes map to their prerendered HTML.
- Known wallet prefixes map to `/index.csr.html`.
- Unknown extensionless paths pass through and should return the real `404.html`.

Public routes:

- `/features`
- `/security`
- `/faq`
- `/guides/best-kaspa-wallet`
- `/guides/kaspa-wallet-app`
- `/guides/kaspa-desktop-wallet`
- `/guides/create-kaspa-wallet`
- `/guides/store-kaspa`

Wallet prefixes:

- `/onboarding`
- `/onboarding-v2`
- `/wallet`
- `/app`
- `/legacy`

Example function body:

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.indexOf('.') !== -1) {
    return request;
  }

  if (uri === '/') {
    request.uri = '/index.html';
    return request;
  }

  if (uri.length > 1 && uri.charAt(uri.length - 1) === '/') {
    uri = uri.slice(0, -1);
  }

  var publicRoutes = {
    '/features': true,
    '/security': true,
    '/faq': true,
    '/guides/best-kaspa-wallet': true,
    '/guides/kaspa-wallet-app': true,
    '/guides/kaspa-desktop-wallet': true,
    '/guides/create-kaspa-wallet': true,
    '/guides/store-kaspa': true
  };

  if (publicRoutes[uri]) {
    request.uri = uri + '/index.html';
    return request;
  }

  var walletPrefixes = ['/onboarding', '/onboarding-v2', '/wallet', '/app', '/legacy'];
  for (var i = 0; i < walletPrefixes.length; i++) {
    var prefix = walletPrefixes[i];
    if (uri === prefix || uri.indexOf(prefix + '/') === 0) {
      request.uri = '/index.csr.html';
      return request;
    }
  }

  return request;
}
```

## Dev validation

Run these after deployment:

```bash
curl -I https://dev-wallet.kaspa.com/faq
curl -s https://dev-wallet.kaspa.com/faq | grep -i "Kaspa Wallet FAQ"
curl -I https://dev-wallet.kaspa.com/onboarding
curl -I https://dev-wallet.kaspa.com/app/home
curl -I https://dev-wallet.kaspa.com/not-a-real-page
```

Expected:

- Public pages return `200`.
- Public page source contains real headings and copy.
- Wallet routes return `200` and load the CSR shell.
- Unknown paths return `404`.
- Dev responses carry `X-Robots-Tag: noindex,nofollow` through CloudFront response headers.
