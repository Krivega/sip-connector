import logger from '@/logger';
import { wrapReconnectError } from './wrapReconnectError';

import type { TAutoConnectorMachineDeps } from './AutoConnectorStateMachine';
import type { TParametersAutoConnect } from './types';

type TCreateMachineDepsParameters = {
  canRetryOnError: (error: unknown) => boolean;
  stopConnectionFlow: () => Promise<void>;
  connect: (parameters: TParametersAutoConnect) => Promise<void>;
  delayBetweenAttempts: () => Promise<void>;
  hasLimitReached: () => boolean;
  emitBeforeAttempt: () => void;
  stopConnectTriggers: () => void;
  startAttempt: () => void;
  incrementAttempt: () => void;
  finishAttempt: () => void;
  emitLimitReachedAttempts: () => void;
  getParametersFromContext: () => TParametersAutoConnect | undefined;
  startCheckTelephony: (parameters: TParametersAutoConnect) => void;
  subscribeToConnectTriggers: (parameters: TParametersAutoConnect) => void;
  emitSuccess: () => void;
  emitStopAttemptsByError: (error: unknown) => void;
  emitCancelledAttempts: (error: unknown) => void;
  emitFailedAllAttempts: (error: Error) => void;
};

const logMissingParameters = (step: string) => {
  logger(`[AutoConnectorManager] ${step}: context.parameters is undefined`);
};

export const createMachineDeps = (
  params: TCreateMachineDepsParameters,
): TAutoConnectorMachineDeps => {
  return {
    canRetryOnError: params.canRetryOnError,
    stopConnectionFlow: params.stopConnectionFlow,
    connect: params.connect,
    delayBetweenAttempts: params.delayBetweenAttempts,
    hasLimitReached: params.hasLimitReached,
    emitBeforeAttempt: params.emitBeforeAttempt,
    stopConnectTriggers: params.stopConnectTriggers,
    startAttempt: params.startAttempt,
    incrementAttempt: params.incrementAttempt,
    finishAttempt: params.finishAttempt,
    emitLimitReachedAttempts: params.emitLimitReachedAttempts,
    startCheckTelephony: () => {
      const machineParameters = params.getParametersFromContext();

      if (!machineParameters) {
        logMissingParameters('startCheckTelephony');

        return;
      }

      params.startCheckTelephony(machineParameters);
    },
    onConnectSucceeded: () => {
      const machineParameters = params.getParametersFromContext();

      if (!machineParameters) {
        logMissingParameters('onConnectSucceeded');

        return;
      }

      params.subscribeToConnectTriggers(machineParameters);
      params.emitSuccess();
    },
    onStopAttemptsByError: params.emitStopAttemptsByError,
    emitCancelledAttemptsRaw: params.emitCancelledAttempts,
    emitCancelledAttemptsWrapped: (error: unknown) => {
      params.emitCancelledAttempts(wrapReconnectError(error));
    },
    onFailedAllAttempts: (error: unknown) => {
      params.emitFailedAllAttempts(wrapReconnectError(error));
    },
    onTelephonyStillConnected: () => {
      params.stopConnectTriggers();
      params.emitSuccess();
    },
  };
};
