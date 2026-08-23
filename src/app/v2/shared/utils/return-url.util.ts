import { ActivatedRoute } from '@angular/router';

const DEFAULT_RETURN_URL = '/app/home';

/**
 * Reads the `returnUrl` query param AuthGuard attaches when it redirects an
 * unauthenticated visit to `/onboarding` (e.g. a pasted covenant link).
 * Restricted to same-app paths to avoid an open redirect via a crafted
 * returnUrl.
 */
export function getSafeReturnUrl(
  route: ActivatedRoute,
  fallback: string = DEFAULT_RETURN_URL,
): string {
  const returnUrl = route.snapshot.queryParamMap.get('returnUrl');
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    return returnUrl;
  }
  return fallback;
}
