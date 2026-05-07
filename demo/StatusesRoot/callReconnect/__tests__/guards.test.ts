import { ECallReconnectStatus } from '@/index';
import {
  isCallReconnectArmed,
  isCallReconnectAttempting,
  isCallReconnectBackoff,
  isCallReconnectErrorTerminal,
  isCallReconnectEvaluating,
  isCallReconnectIdle,
  isCallReconnectLimitReached,
  isCallReconnectWaitingSignaling,
} from '../guards';

import type { TCallReconnectContextMap, TCallRedialParameters } from '@/index';

const expectType = <T>(value: T): T => {
  return value;
};

const stateGuards = {
  isCallReconnectIdle,
  isCallReconnectArmed,
  isCallReconnectEvaluating,
  isCallReconnectBackoff,
  isCallReconnectWaitingSignaling,
  isCallReconnectAttempting,
  isCallReconnectLimitReached,
  isCallReconnectErrorTerminal,
} as const;

type TGuardName = keyof typeof stateGuards;

type TRuntimeInstance = {
  state: ECallReconnectStatus;
  context: TCallReconnectContextMap[ECallReconnectStatus];
};

type TCase = {
  title: string;
  value: TRuntimeInstance;
  expectedGuard: TGuardName;
};

const redialParameters: TCallRedialParameters = {
  getCallParameters: async () => {
    return {} as never;
  },
};

const createDefaultContext = <TState extends ECallReconnectStatus>(
  state: TState,
): TCallReconnectContextMap[TState] => {
  if (state === ECallReconnectStatus.IDLE) {
    return {
      parameters: undefined,
      attempt: 0,
      nextDelayMs: 0,
      lastError: undefined,
      lastFailureCause: undefined,
      cancelledReason: undefined,
    } as TCallReconnectContextMap[TState];
  }

  return {
    parameters: redialParameters,
    attempt: 1,
    nextDelayMs: 1000,
    lastError: undefined,
    lastFailureCause: undefined,
    cancelledReason: undefined,
  } as TCallReconnectContextMap[TState];
};

const runtimeCases: TCase[] = [
  {
    title: 'IDLE',
    value: {
      state: ECallReconnectStatus.IDLE,
      context: createDefaultContext(ECallReconnectStatus.IDLE),
    },
    expectedGuard: 'isCallReconnectIdle',
  },
  {
    title: 'ARMED',
    value: {
      state: ECallReconnectStatus.ARMED,
      context: createDefaultContext(ECallReconnectStatus.ARMED),
    },
    expectedGuard: 'isCallReconnectArmed',
  },
  {
    title: 'EVALUATING',
    value: {
      state: ECallReconnectStatus.EVALUATING,
      context: createDefaultContext(ECallReconnectStatus.EVALUATING),
    },
    expectedGuard: 'isCallReconnectEvaluating',
  },
  {
    title: 'BACKOFF',
    value: {
      state: ECallReconnectStatus.BACKOFF,
      context: createDefaultContext(ECallReconnectStatus.BACKOFF),
    },
    expectedGuard: 'isCallReconnectBackoff',
  },
  {
    title: 'WAITING_SIGNALING',
    value: {
      state: ECallReconnectStatus.WAITING_SIGNALING,
      context: createDefaultContext(ECallReconnectStatus.WAITING_SIGNALING),
    },
    expectedGuard: 'isCallReconnectWaitingSignaling',
  },
  {
    title: 'ATTEMPTING',
    value: {
      state: ECallReconnectStatus.ATTEMPTING,
      context: createDefaultContext(ECallReconnectStatus.ATTEMPTING),
    },
    expectedGuard: 'isCallReconnectAttempting',
  },
  {
    title: 'LIMIT_REACHED',
    value: {
      state: ECallReconnectStatus.LIMIT_REACHED,
      context: createDefaultContext(ECallReconnectStatus.LIMIT_REACHED),
    },
    expectedGuard: 'isCallReconnectLimitReached',
  },
  {
    title: 'ERROR_TERMINAL',
    value: {
      state: ECallReconnectStatus.ERROR_TERMINAL,
      context: createDefaultContext(ECallReconnectStatus.ERROR_TERMINAL),
    },
    expectedGuard: 'isCallReconnectErrorTerminal',
  },
];

describe('CallReconnectStatus guards', () => {
  it.each(runtimeCases)('runs all per-state guards for $title', ({ value, expectedGuard }) => {
    (
      Object.entries(stateGuards) as [TGuardName, (instance: TRuntimeInstance) => boolean][]
    ).forEach(([guardName, guard]) => {
      expect(guard(value)).toBe(guardName === expectedGuard);
    });
  });

  it('narrows types at compile time via all guards', () => {
    type TGuardCandidate = {
      [TState in ECallReconnectStatus]: {
        state: TState;
        context: TCallReconnectContextMap[TState];
      };
    }[ECallReconnectStatus];

    const assertNarrowing = (candidate: TGuardCandidate) => {
      if (isCallReconnectIdle(candidate)) {
        expectType(candidate);
        expectType<undefined>(candidate.context.parameters);
      }

      if (isCallReconnectArmed(candidate)) {
        expectType(candidate);
        expectType<TCallRedialParameters>(candidate.context.parameters);
      }

      if (isCallReconnectEvaluating(candidate)) {
        expectType(candidate);
        expectType<number>(candidate.context.attempt);
      }

      if (isCallReconnectBackoff(candidate)) {
        expectType(candidate);
        expectType<number>(candidate.context.nextDelayMs);
      }

      if (isCallReconnectWaitingSignaling(candidate)) {
        expectType(candidate);
        expectType<TCallRedialParameters>(candidate.context.parameters);
      }

      if (isCallReconnectAttempting(candidate)) {
        expectType(candidate);
        expectType<number>(candidate.context.attempt);
      }

      if (isCallReconnectLimitReached(candidate)) {
        expectType(candidate);
        expectType<string | undefined>(candidate.context.lastFailureCause);
      }

      if (isCallReconnectErrorTerminal(candidate)) {
        expectType(candidate);
        expectType<unknown>(candidate.context.lastError);
      }
    };

    const sample: TGuardCandidate = {
      state: ECallReconnectStatus.ATTEMPTING,
      context: createDefaultContext(ECallReconnectStatus.ATTEMPTING),
    };

    assertNarrowing(sample);
    expect(true).toBe(true);
  });
});
