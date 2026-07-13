import {
  Injectable,
  OnDestroy,
  Signal,
  signal,
  WritableSignal,
  inject,
} from '@angular/core';
import { RpcService } from './rpc.service';
import { RpcConnectionStatus } from '../../types/kaspa-network/rpc-connection-status.enum';
import { ConnectStrategy, RpcClient } from '../../../../public/kaspa/kaspa';

const CONNECTION_TIMEOUT = 10 * 1000;
const SERVER_INFO_TIMEOUT = 5 * 1000;
const BASE_RECONNECT_DELAY = 1 * 1000;
const MAX_RECONNECT_DELAY = 30 * 1000;

@Injectable({
  providedIn: 'root',
})
export class KaspaNetworkConnectionManagerService implements OnDestroy {
  private readonly rpcService = inject(RpcService);

  private connectionPromise?: Promise<void>;
  private connectionGeneration = 0;
  private activeConnectingRpc?: RpcClient;
  private reconnectTimeout?: ReturnType<typeof setTimeout>;
  private reconnectScheduledFor?: number;
  private reconnectAttempts = 0;
  private attachedRpcs = new WeakSet<RpcClient>();
  private onlineHandler?: () => void;
  private visibilityHandler?: () => void;
  private connectionStatusSignal: WritableSignal<RpcConnectionStatus> =
    signal<RpcConnectionStatus>(RpcConnectionStatus.DISCONNECTED);

  constructor() {
    this.listenForBrowserResume();
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) {
        window.removeEventListener('online', this.onlineHandler);
        this.onlineHandler = undefined;
      }
      if (this.visibilityHandler) {
        document.removeEventListener(
          'visibilitychange',
          this.visibilityHandler,
        );
        this.visibilityHandler = undefined;
      }
    }
    this.clearReconnectTimeout();
  }

  private setSignalStatusIfChanged(status: RpcConnectionStatus) {
    if (this.connectionStatusSignal() != status) {
      this.connectionStatusSignal.set(status);
    }
  }

  private listenForBrowserResume(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.onlineHandler = () => this.scheduleReconnect('browser-online', 0);
    window.addEventListener('online', this.onlineHandler);

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.scheduleReconnect('tab-visible', 0);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private attachDisconnectHandler(currentRpc: RpcClient): void {
    if (this.attachedRpcs.has(currentRpc)) {
      return;
    }
    this.attachedRpcs.add(currentRpc);

    currentRpc.addEventListener('disconnect', () => {
      if (this.rpcService.getRpc() !== currentRpc) {
        return;
      }

      console.warn('Disconnected from current Kaspa RPC');
      this.setSignalStatusIfChanged(RpcConnectionStatus.DISCONNECTED);
      this.scheduleReconnect('rpc-disconnect');
    });
  }

  private scheduleReconnect(
    reason: string,
    delay?: number,
    generation = this.connectionGeneration,
  ): void {
    if (generation !== this.connectionGeneration) {
      return;
    }

    if (this.reconnectTimeout) {
      // Backoff retries (no explicit delay) yield to whatever is already scheduled.
      // Explicit-delay callers (online/visibility resume) preempt only if sooner.
      if (delay === undefined) {
        return;
      }
      const newScheduledFor = Date.now() + delay;
      if (
        this.reconnectScheduledFor !== undefined &&
        newScheduledFor >= this.reconnectScheduledFor
      ) {
        return;
      }
      this.clearReconnectTimeout();
    }

    const reconnectDelay = delay ?? this.getReconnectDelay();
    this.reconnectScheduledFor = Date.now() + reconnectDelay;
    this.reconnectTimeout = setTimeout(() => {
      if (generation !== this.connectionGeneration) {
        return;
      }

      this.reconnectTimeout = undefined;
      this.reconnectScheduledFor = undefined;

      const rpc = this.rpcService.getRpc();
      if (rpc?.isConnected) {
        this.setSignalStatusIfChanged(RpcConnectionStatus.CONNECTED);
        return;
      }

      this.waitForConnection(true).catch((err) => {
        console.warn(`Kaspa RPC reconnect failed after ${reason}`, err);
      });
    }, reconnectDelay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    this.reconnectScheduledFor = undefined;
  }

  private getReconnectDelay(): number {
    const exponentialDelay =
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts++);
    const jitter = Math.floor(Math.random() * 500);
    return Math.min(exponentialDelay + jitter, MAX_RECONNECT_DELAY);
  }

  private async handleConnection(
    forceRefresh = false,
    generation = this.connectionGeneration,
  ): Promise<void> {
    console.log('Trying to connect to RPC...');

    const currentRpc = forceRefresh
      ? this.rpcService.refreshRpc({ resetConfiguredRpcUrl: true })
      : (this.rpcService.getRpc() ?? this.rpcService.refreshRpc());

    if (!currentRpc) {
      throw new Error('RPC client is not initialized');
    }

    if (generation !== this.connectionGeneration) {
      await this.disconnectRpc(currentRpc);
      throw new Error('RPC client was replaced before connecting');
    }

    this.activeConnectingRpc = currentRpc;
    this.attachDisconnectHandler(currentRpc);

    try {
      await this.withTimeout(
        currentRpc.connect({
          strategy: ConnectStrategy.Fallback,
          timeoutDuration: CONNECTION_TIMEOUT,
        }),
        CONNECTION_TIMEOUT,
        'Rpc connection timeout',
      );

      if (
        generation !== this.connectionGeneration ||
        this.rpcService.getRpc() !== currentRpc
      ) {
        await this.disconnectRpc(currentRpc);
        throw new Error('RPC client was replaced while connecting');
      }

      if (!(await this.isServerValid(currentRpc))) {
        await this.disconnectRpc(currentRpc);
        throw new Error('Rpc connected to an invalid server');
      }
    } catch (err) {
      await this.disconnectRpc(currentRpc);
      if (this.activeConnectingRpc === currentRpc) {
        this.activeConnectingRpc = undefined;
      }

      if (
        generation === this.connectionGeneration &&
        this.rpcService.isUsingConfiguredRpcUrl()
      ) {
        if (this.rpcService.useNextConfiguredRpcUrl()) {
          console.warn(
            'Configured Kaspa RPC failed; trying next configured RPC',
            err,
          );
        } else {
          console.warn(
            'Configured Kaspa RPCs failed; falling back to resolver',
            err,
          );
          this.rpcService.useResolver();
        }

        return await this.handleConnection(false, generation);
      }

      if (generation === this.connectionGeneration) {
        this.setSignalStatusIfChanged(RpcConnectionStatus.DISCONNECTED);
        this.scheduleReconnect('connection-failure', undefined, generation);
      }
      throw err;
    }

    if (generation !== this.connectionGeneration) {
      await this.disconnectRpc(currentRpc);
      if (this.activeConnectingRpc === currentRpc) {
        this.activeConnectingRpc = undefined;
      }
      throw new Error('RPC client was replaced while connecting');
    }

    if (this.activeConnectingRpc === currentRpc) {
      this.activeConnectingRpc = undefined;
    }
    this.reconnectAttempts = 0;
    this.setSignalStatusIfChanged(RpcConnectionStatus.CONNECTED);
    console.log('RPC Connected Successfully');
  }

  private async disconnectRpc(rpc: RpcClient): Promise<void> {
    try {
      await rpc.disconnect();
    } catch (err) {
      console.warn('Failed disconnecting RPC', err);
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private async isServerValid(rpc: RpcClient): Promise<boolean> {
    if (!rpc.isConnected) {
      return false;
    }

    try {
      const serverInfo = await this.withTimeout(
        rpc.getServerInfo(),
        SERVER_INFO_TIMEOUT,
        'getServerInfo Timeout',
      );

      return serverInfo.isSynced && serverInfo.hasUtxoIndex;
    } catch (err) {
      console.error('Failed getServerInfo', err);
      return false;
    }
  }

  public async waitForConnection(forceRefresh = false): Promise<void> {
    const rpc = this.rpcService.getRpc();
    if (!forceRefresh && rpc?.isConnected) {
      this.setSignalStatusIfChanged(RpcConnectionStatus.CONNECTED);
      return;
    }

    if (forceRefresh) {
      this.connectionGeneration++;
      this.clearReconnectTimeout();
      this.reconnectAttempts = 0;
      if (this.activeConnectingRpc) {
        void this.disconnectRpc(this.activeConnectingRpc);
        this.activeConnectingRpc = undefined;
      }
      this.connectionPromise = undefined;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    const generation = this.connectionGeneration;
    this.clearReconnectTimeout();

    this.setSignalStatusIfChanged(RpcConnectionStatus.CONNECTING);

    this.connectionPromise = this.handleConnection(forceRefresh, generation)
      .catch((err) => {
        if (generation === this.connectionGeneration) {
          this.setSignalStatusIfChanged(RpcConnectionStatus.DISCONNECTED);
        }
        throw err;
      })
      .finally(() => {
        if (generation === this.connectionGeneration) {
          this.connectionPromise = undefined;
        }
      });

    return this.connectionPromise;
  }

  getConnectionStatusSignal(): Signal<RpcConnectionStatus> {
    return this.connectionStatusSignal.asReadonly();
  }
}
