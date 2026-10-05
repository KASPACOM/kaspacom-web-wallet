import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AddressResolutionService } from './address-resolution.service';
import { DotkService } from './dotk/dotk.service';
import { KaspaL1NetworkService } from './kaspa-netwrok-services/kaspa-l1-network.service';
import { KnsApiService } from './kns-api/kns-api.service';
import { UtilsHelper } from './utils.service';
import { WalletService } from './wallet.service';

describe('AddressResolutionService Dot.K support', () => {
  let service: AddressResolutionService;
  let dotkService: jasmine.SpyObj<DotkService>;
  let utils: jasmine.SpyObj<UtilsHelper>;
  let walletService: jasmine.SpyObj<WalletService>;

  beforeEach(() => {
    dotkService = jasmine.createSpyObj<DotkService>('DotkService', [
      'resolveRecipient',
    ]);
    utils = jasmine.createSpyObj<UtilsHelper>('UtilsHelper', [
      'isValidWalletAddress',
      'isValidEthereumAddress',
    ]);
    walletService = jasmine.createSpyObj<WalletService>('WalletService', [
      'isL2Display',
    ]);

    const knsApi = jasmine.createSpyObj<KnsApiService>('KnsApiService', [
      'fetchDomainInfo',
    ]);
    const network = jasmine.createSpyObj<KaspaL1NetworkService>(
      'KaspaL1NetworkService',
      ['isMainnet'],
    );

    walletService.isL2Display.and.returnValue(false);
    utils.isValidWalletAddress.and.callFake((input: string) =>
      input.startsWith('kaspa:'),
    );
    utils.isValidEthereumAddress.and.returnValue(false);
    knsApi.fetchDomainInfo.and.returnValue(of(undefined));
    network.isMainnet.and.returnValue(true);

    TestBed.configureTestingModule({
      providers: [
        AddressResolutionService,
        { provide: DotkService, useValue: dotkService },
        { provide: UtilsHelper, useValue: utils },
        { provide: WalletService, useValue: walletService },
        { provide: KnsApiService, useValue: knsApi },
        { provide: KaspaL1NetworkService, useValue: network },
      ],
    });

    service = TestBed.inject(AddressResolutionService);
  });

  it('recognizes .k names case-insensitively without confusing KNS names', () => {
    expect(service.isPotentialDotkDomain('alice.k')).toBeTrue();
    expect(service.isPotentialDotkDomain(' Alice.K ')).toBeTrue();
    expect(service.isPotentialDotkDomain('alice.kas')).toBeFalse();
    expect(service.isPotentialDotkDomain('bad name.k')).toBeFalse();
  });

  it('resolves a .k recipient through Dot.K', async () => {
    dotkService.resolveRecipient.and.resolveTo({
      address: 'kaspa:qrecipient',
      display: 'alice.k',
    });

    const result = await service.resolve(' Alice.K ');

    expect(dotkService.resolveRecipient).toHaveBeenCalledOnceWith('Alice.K');
    expect(result).toEqual({
      effectiveAddress: 'kaspa:qrecipient',
      source: 'dotk',
      resolvedDomain: 'alice.k',
    });
  });

  it('returns the Dot.K resolution error for an unresolved name', async () => {
    dotkService.resolveRecipient.and.resolveTo({
      address: null,
      display: 'missing.k',
      error: 'Dot.K name not found',
    });

    const result = await service.resolve('missing.k');

    expect(result).toEqual({
      effectiveAddress: null,
      source: 'dotk',
      resolvedDomain: 'missing.k',
      error: 'Dot.K name not found',
    });
  });

  it('keeps direct Kaspa addresses on the direct path', async () => {
    const result = await service.resolve('kaspa:qrecipient');

    expect(result).toEqual({
      effectiveAddress: 'kaspa:qrecipient',
      source: 'direct',
    });
    expect(dotkService.resolveRecipient).not.toHaveBeenCalled();
  });
});
