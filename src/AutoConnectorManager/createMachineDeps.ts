import { hasConnectionPromiseIsNotActualError } from '@/ConnectionQueueManager';
import { wrapReconnectError } from './wrapReconnectError';

import type { AutoConnectorRuntime } from './AutoConnectorRuntime';
import type { TAutoConnectorMachineDeps } from './AutoConnectorStateMachine';
import type { TParametersAutoConnect } from './types';

type TCreateMachineDepsParameters = {
  runtime: AutoConnectorRuntime;
  canRetryOnError: (error: unknown) => boolean;
};

export const createMachineDeps = (
  params: TCreateMachineDepsParameters,
): TAutoConnectorMachineDeps => {
  const toTerminalError = ({
    stopReason,
    lastError,
  }: {
    stopReason: 'halted' | 'cancelled' | 'failed' | undefined;
    lastError: unknown;
  }) => {
    if (stopReason === 'cancelled' && !hasConnectionPromiseIsNotActualError(lastError)) {
      return wrapReconnectError(lastError);
    }

    if (stopReason === 'failed') {
      return wrapReconnectError(lastError);
    }

    return lastError;
  };

  return {
    canRetryOnError: params.canRetryOnError,
    shouldDisconnectBeforeAttempt: () => {
      return params.runtime.shouldDisconnectBeforeAttempt();
    },
    stopConnectionFlow: async () => {
      await params.runtime.stopConnectionFlow();
    },
    connect: async (parameters: TParametersAutoConnect) => {
      await params.runtime.connect(parameters);
    },
    delayBetweenAttempts: async () => {
      await params.runtime.delayBeforeRetry();
    },
    hasLimitReached: () => {
      return params.runtime.hasLimitReached();
    },
    beforeAttempt: () => {
      params.runtime.beforeAttempt();
    },
    beforeConnectAttempt: () => {
      params.runtime.beforeConnectAttempt();
    },
    onLimitReached: (parameters: TParametersAutoConnect) => {
      params.runtime.onLimitReached(parameters);
    },
    onConnectSucceeded: (parameters: TParametersAutoConnect) => {
      params.runtime.onConnectSucceeded(parameters);
    },
    emitTerminalOutcome: ({ stopReason, lastError }) => {
      params.runtime.emitTerminalOutcome({
        stopReason,
        // Нормализуем только те ветки, где контракт событий требует Error-объект.
        lastError: toTerminalError({ stopReason, lastError }),
      });
    },
    onTelephonyStillConnected: () => {
      params.runtime.onTelephonyStillConnected();
    },
  };
};
