import { createLoggerMockModule } from '@/__fixtures__/logger.mock';
import resolveDebug from '@/logger';
import { AutoConnectorStateMachine } from '../AutoConnectorStateMachine';
import { createAutoConnectorMachine } from '../createAutoConnectorMachine';

import type { TParametersAutoConnect } from '../../types';

jest.mock('@/logger', () => {
  return createLoggerMockModule();
});

const mockDebug = (resolveDebug as jest.Mock).mock.results[0].value as jest.Mock;

const parameters: TParametersAutoConnect = {
  getParameters: async () => {
    return {
      displayName: 'u',
      sipServerIp: 'sip:u',
      sipServerUrl: 'wss://u',
      remoteAddress: '10.10.10.10',
      iceServers: [],
      register: false,
    };
  },
};

const minimalDeps = (): Parameters<typeof createAutoConnectorMachine>[0] => {
  return {
    canRetryOnError: () => {
      return true;
    },
    shouldDisconnectBeforeAttempt: () => {
      return false;
    },
    stopConnectionFlow: jest.fn(async () => {}),
    connect: jest.fn(async () => {}),
    delayBetweenAttempts: jest.fn(async () => {}),
    hasLimitReached: () => {
      return false;
    },
    beforeAttempt: jest.fn(),
    beforeConnectAttempt: jest.fn(),
    onLimitReached: jest.fn(),
    onConnectSucceeded: jest.fn(),
    emitTerminalOutcome: jest.fn(),
    onTelephonyStillConnected: jest.fn(),
  };
};

describe('AutoConnectorStateMachine', () => {
  beforeEach(() => {
    mockDebug.mockClear();
  });

  it('не отправляет событие, если переход недопустим', () => {
    const sm = new AutoConnectorStateMachine(createAutoConnectorMachine(minimalDeps()));

    sm.send({ type: 'TELEPHONY.RESULT', outcome: 'stillConnected' });

    expect(mockDebug).toHaveBeenCalledWith(
      expect.stringContaining('[AutoConnectorStateMachine] Invalid transition: TELEPHONY.RESULT'),
    );
  });

  it('отправляет допустимое событие', () => {
    const sm = new AutoConnectorStateMachine(createAutoConnectorMachine(minimalDeps()));

    sm.send({ type: 'AUTO.RESTART', parameters });

    expect(sm.state).not.toBe('idle');
  });

  it('isInIdleState: возвращает true только в состоянии idle', () => {
    const sm = new AutoConnectorStateMachine(createAutoConnectorMachine(minimalDeps()));

    expect(sm.isInIdleState()).toBe(true);

    sm.send({ type: 'AUTO.RESTART', parameters });

    expect(sm.isInIdleState()).toBe(false);
  });
});
