import { Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { RpcService } from './rpc.service';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';

const CONNECTION_TIMEOUT = 20 * 1000;
const SERVER_INFO_TIMEOUT = 5 * 1000;

@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkConnectionManagerService {
  private connectionPromise?: Promise<void>;
  private connectionMadeResolve?: (value: void | PromiseLike<void>) => void;
  private connectionMadeReject?: (reason?: any) => void;
  private isTryingToConnect?: boolean = false;
  private connectionStatusSignal: WritableSignal<RpcConnectionStatus> =
    signal<RpcConnectionStatus>(RpcConnectionStatus.DISCONNECTED);

  constructor(private readonly rpcService: RpcService) {}

  private initPromise() {
    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionMadeResolve = resolve;
      this.connectionMadeReject = reject;
    });
    this.connectionPromise.catch((err) =>
      console.error('Failed initializing connection', err)
    );
  }

  private async handleConnection() {
    console.log('Trying to connect to RPC...');

    let reachedTimeout = false;

    let timeoutForConnection: ReturnType<typeof setTimeout> | null = setTimeout(
      () => {
        console.error('Rpc connection timeout, connect function stuck');

        this.connectionMadeReject!();
        reachedTimeout = true;
      },
      CONNECTION_TIMEOUT
    );

    try {
      const currentRpc = await this.rpcService.refreshRpc();
      await currentRpc!.connect();

      if (reachedTimeout) {
        console.error('Rpc connection reached time out');
        try {
          await currentRpc!.disconnect();
        } catch (err) {
          console.error('Failed disconnecting RPC', err);
        }

        throw new Error('Rpc connection reached time out');
      }

      clearTimeout(timeoutForConnection);
      timeoutForConnection = null;

      if (!(await this.isServerValid())) {
        await currentRpc!.disconnect();
        throw new Error('Rpc connected to an invalid server');
      }
    } catch (err) {
      console.error('Failed connecting RPC', err);

      if (!reachedTimeout) {
        this.connectionMadeReject!('Failed connecting to RPC');
      }
      return;
    } finally {
      if (timeoutForConnection) {
        clearTimeout(timeoutForConnection);
      }
    }

    console.log('RPC Connected Successfully');

    this.connectionMadeResolve!();
  }

  private async isServerValid(): Promise<boolean> {
    if (!this.rpcService.getRpc()!.isConnected) {
      return false;
    }

    return new Promise(async (res) => {
      let isTimeoutCalled = false;

      const timeout = setTimeout(async () => {
        console.error('getServerInfo Timeout');
        isTimeoutCalled = true;
        res(false);
      }, SERVER_INFO_TIMEOUT);

      try {
        const serverInfo = await this.rpcService.getRpc()!.getServerInfo();

        if (!isTimeoutCalled) {
          res(serverInfo.isSynced && serverInfo.hasUtxoIndex);
        }
      } catch (err) {
        console.error('Failed getServerInfo', err);
        if (!isTimeoutCalled) {
          res(false);
        }
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  public async waitForConnection(): Promise<void> {
    if (!this.rpcService.getRpc()!.isConnected && !this.isTryingToConnect) {
      this.isTryingToConnect = true;
      this.initPromise();
      this.handleConnection();
      this.connectionStatusSignal.set(RpcConnectionStatus.CONNECTING);
    }

    try {
      await this.connectionPromise;

      if (!this.rpcService.getRpc()!.isConnected) {
        throw new Error('Rpc not connected');
      }

      this.connectionStatusSignal.set(
        this.rpcService.getRpc()!.isConnected
          ? RpcConnectionStatus.CONNECTED
          : RpcConnectionStatus.DISCONNECTED
      );
    } catch (err) {
      console.log('catch connectionPromise');
      this.connectionStatusSignal.set(RpcConnectionStatus.DISCONNECTED);

      throw err;
    } finally {
      this.isTryingToConnect = false;
    }
  }

  getConnectionStatusSignal(): Signal<RpcConnectionStatus> {
    return this.connectionStatusSignal.asReadonly();
  }
}
