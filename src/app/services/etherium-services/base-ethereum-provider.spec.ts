import { ethers } from 'ethers';
import {
  BaseEthereumProvider,
  EvmRpcReadError,
} from './base-ethereum-provider';

describe('BaseEthereumProvider balance reads', () => {
  let getBalanceSpy: jasmine.Spy;
  let urls: string[];
  const config = {
    chainId: '0x1',
    chainName: 'Test',
    nativeCurrency: { name: 'Test', symbol: 'TST', decimals: 18 },
    rpcUrls: ['https://one.invalid', 'https://two.invalid'],
    blockExplorerUrls: [],
  };

  class TestProvider extends BaseEthereumProvider {
    protected override createProvider(url: string): ethers.JsonRpcProvider {
      urls.push(url);
      return {
        getBalance: getBalanceSpy,
        destroy: jasmine.createSpy('destroy'),
      } as unknown as ethers.JsonRpcProvider;
    }
  }

  beforeEach(() => {
    getBalanceSpy = jasmine.createSpy('getBalance');
    urls = [];
  });

  it('retries a transient balance error and rotates endpoints', async () => {
    const provider = new TestProvider(config);
    getBalanceSpy.and.returnValues(
      Promise.reject(new Error('internal error')),
      Promise.resolve(12n),
    );

    await expectAsync(provider.getWalletBalance('0xabc')).toBeResolvedTo(12n);
    expect(urls).toContain('https://two.invalid');
  });

  it('still fails over and reports EvmRpcReadError when provider teardown throws', async () => {
    class HostileTeardownProvider extends BaseEthereumProvider {
      protected override createProvider(url: string): ethers.JsonRpcProvider {
        urls.push(url);
        return {
          getBalance: getBalanceSpy,
          destroy: () => {
            throw new Error('provider is already destroyed');
          },
        } as unknown as ethers.JsonRpcProvider;
      }
    }
    const provider = new HostileTeardownProvider(config);
    getBalanceSpy.and.rejectWith(new Error('internal error'));

    await expectAsync(provider.getWalletBalance('0xabc')).toBeRejectedWithError(
      EvmRpcReadError,
      'eth_getBalance failed after 3 attempts',
    );
    expect(urls).toContain('https://two.invalid');
  });

  it('throws a categorized error after bounded retries', async () => {
    const provider = new TestProvider(config);
    getBalanceSpy.and.rejectWith(new Error('internal error'));

    await expectAsync(provider.getWalletBalance('0xabc')).toBeRejectedWithError(
      EvmRpcReadError,
      'eth_getBalance failed after 3 attempts',
    );
    expect(getBalanceSpy).toHaveBeenCalledTimes(3);
  });
});
