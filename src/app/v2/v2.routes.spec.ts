import { V2TMP_ROUTES } from './v2.routes';

describe('V2 wallet routes', () => {
  it('redirects the retired NFT marketplace route to collectables', () => {
    const legacyRoute = V2TMP_ROUTES.find(
      (route) => route.path === 'nft/marketplace',
    );

    expect(legacyRoute).toEqual(
      jasmine.objectContaining({
        pathMatch: 'full',
        redirectTo: 'app/collectables',
      }),
    );
  });
});
