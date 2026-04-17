import { CancelableRequest } from '@krivega/cancelable-promise';
import { DelayRequester } from '@krivega/timeout-requester';

import resolveDebug from '@/logger';
import AttemptsState from './AttemptsState';
import { computeBackoffDelay } from './policies/BackoffPolicy';
import { createNetworkFailurePolicy } from './policies/NetworkFailurePolicy';

import type { EndEvent } from '@krivega/jssip';
import type { CallManager } from '@/CallManager';
import type { ConnectionManager } from '@/ConnectionManager';
import type {
  ICallReconnectOptions,
  ICallReconnectOptionsResolved,
  TCallRedialParameters,
} from './types';

const debug = resolveDebug('CallReconnectRuntime');

const DEFAULTS: ICallReconnectOptionsResolved = {
  maxAttempts: 5,
  baseBackoffMs: 1000,
  maxBackoffMs: 30_000,
  backoffFactor: 2,
  jitter: 'equal',
  waitSignalingTimeoutMs: 20_000,
};

type TEmitters = {
  emitStatusChange: (payload: { isReconnecting: boolean }) => void;
};

type TRuntimeParameters = {
  callManager: CallManager;
  connectionManager: ConnectionManager;
  options?: ICallReconnectOptions;
  emitters: TEmitters;
};

const resolveOptions = (options?: ICallReconnectOptions): ICallReconnectOptionsResolved => {
  return {
    maxAttempts: options?.maxAttempts ?? DEFAULTS.maxAttempts,
    baseBackoffMs: options?.baseBackoffMs ?? DEFAULTS.baseBackoffMs,
    maxBackoffMs: options?.maxBackoffMs ?? DEFAULTS.maxBackoffMs,
    backoffFactor: options?.backoffFactor ?? DEFAULTS.backoffFactor,
    jitter: options?.jitter ?? DEFAULTS.jitter,
    waitSignalingTimeoutMs: options?.waitSignalingTimeoutMs ?? DEFAULTS.waitSignalingTimeoutMs,
  };
};

const defaultCanRetryOnError = (_error: unknown): boolean => {
  return true;
};

/**
 * Runtime инкапсулирует все side-effects `CallReconnectManager`.
 *
 * Машина только декларирует переходы и дергает runtime через `TCallReconnectMachineDeps`.
 * Здесь живут: `CancelableRequest` над `startCall`, `DelayRequester` для backoff,
 * координация с `ConnectionManager` (ожидание готовности сигнализации), `AttemptsState`.
 */
export class CallReconnectRuntime {
  public readonly resolvedOptions: ICallReconnectOptionsResolved;

  private readonly callManager: CallManager;

  private readonly connectionManager: ConnectionManager;

  private readonly attemptsState: AttemptsState;

  private readonly delayRequester: DelayRequester;

  private readonly performCall: CancelableRequest<TCallRedialParameters, Promise<void>>;

  private readonly isNetworkFailureFn: (event: EndEvent) => boolean;

  private readonly canRetryOnErrorFn: (error: unknown) => boolean;

  private unsubscribeConnectionWait?: () => void;

  public constructor(parameters: TRuntimeParameters) {
    this.resolvedOptions = resolveOptions(parameters.options);
    this.callManager = parameters.callManager;
    this.connectionManager = parameters.connectionManager;
    this.isNetworkFailureFn = createNetworkFailurePolicy(parameters.options?.isNetworkFailure);
    this.canRetryOnErrorFn = parameters.options?.canRetryOnError ?? defaultCanRetryOnError;
    this.delayRequester = new DelayRequester(this.resolvedOptions.baseBackoffMs);
    this.performCall = new CancelableRequest<TCallRedialParameters, Promise<void>>(
      async (callParameters) => {
        const snapshot = await callParameters.getCallParameters();

        await this.callManager.startCall(
          this.connectionManager.getUaProtected(),
          this.connectionManager.getUri.bind(this.connectionManager),
          snapshot,
        );
      },
    );
    this.attemptsState = new AttemptsState({
      limit: this.resolvedOptions.maxAttempts,
      onStatusChange: ({ isInProgress }) => {
        parameters.emitters.emitStatusChange({ isReconnecting: isInProgress });
      },
    });
  }

  public isNetworkFailure(event: EndEvent): boolean {
    return this.isNetworkFailureFn(event);
  }

  public canRetryOnError(error: unknown): boolean {
    return this.canRetryOnErrorFn(error);
  }

  public isSignalingReady(): boolean {
    return this.connectionManager.isRegistered;
  }

  public hasLimitReached(): boolean {
    return this.attemptsState.hasLimitReached();
  }

  public computeNextDelayMs(attempt: number): number {
    return computeBackoffDelay(attempt, {
      baseBackoffMs: this.resolvedOptions.baseBackoffMs,
      maxBackoffMs: this.resolvedOptions.maxBackoffMs,
      backoffFactor: this.resolvedOptions.backoffFactor,
      jitter: this.resolvedOptions.jitter,
    });
  }

  public async delayBeforeAttempt(nextDelayMs: number): Promise<void> {
    debug('delayBeforeAttempt', nextDelayMs);

    await this.delayRequester.request(nextDelayMs);
  }

  public async waitSignalingReady(): Promise<void> {
    // Ранний выход: сигнализация уже живая — не ставим лишних таймеров.
    if (this.connectionManager.isRegistered) {
      return;
    }

    const timeoutMs = this.resolvedOptions.waitSignalingTimeoutMs;

    await new Promise<void>((resolve, reject) => {
      let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
      let handleReady: (() => void) | undefined;

      const cleanup = () => {
        /* istanbul ignore else -- defensive: timeoutId всегда назначен до первого вызова cleanup */
        if (timeoutId !== undefined) {
          globalThis.clearTimeout(timeoutId);
        }

        /* istanbul ignore else -- defensive: handleReady назначается до регистрации в cleanup */
        if (handleReady !== undefined) {
          this.connectionManager.off('connected', handleReady);
          this.connectionManager.off('registered', handleReady);
        }

        this.unsubscribeConnectionWait = undefined;
      };

      handleReady = () => {
        cleanup();
        resolve();
      };

      timeoutId = globalThis.setTimeout(() => {
        cleanup();
        reject(new Error(`Wait signaling ready timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.unsubscribeConnectionWait = cleanup;
      this.connectionManager.on('connected', handleReady);
      this.connectionManager.on('registered', handleReady);
    });
  }

  public async performAttempt(parameters: TCallRedialParameters): Promise<void> {
    await this.performCall.request(parameters);
  }

  public registerAttemptStart(): void {
    this.attemptsState.increment();
    this.attemptsState.startAttempt();
  }

  public registerAttemptFinish(): void {
    this.attemptsState.finishAttempt();
  }

  public resetAttemptsState(): void {
    this.attemptsState.reset();
  }

  public cancelAll(): void {
    debug('cancelAll');

    this.delayRequester.cancelRequest();
    this.performCall.cancelRequest();
    this.unsubscribeConnectionWait?.();
    this.unsubscribeConnectionWait = undefined;
  }

  public getWaitSignalingTimeoutMs(): number {
    return this.resolvedOptions.waitSignalingTimeoutMs;
  }
}
