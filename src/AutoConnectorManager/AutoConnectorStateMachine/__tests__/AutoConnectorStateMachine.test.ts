import { AutoConnectorStateMachine } from '../AutoConnectorStateMachine';
import { createAutoConnectorMachine } from '../createAutoConnectorMachine';

import type { TParametersAutoConnect } from '../../types';

const parameters: TParametersAutoConnect = {
  getParameters: async () => {
    return {
      displayName: 'u',
      sipServerIp: 'sip:u',
      sipServerUrl: 'wss://u',
      register: false,
    };
  },
};

const minimalDeps = (): Parameters<typeof createAutoConnectorMachine>[0] => {
  return {
    canRetryOnError: () => {
      return true;
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
  it('не отправляет событие, если переход недопустим', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const sm = new AutoConnectorStateMachine(createAutoConnectorMachine(minimalDeps()));

    sm.send({ type: 'TELEPHONY.RESULT', outcome: 'stillConnected' });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('отправляет допустимое событие', () => {
    const sm = new AutoConnectorStateMachine(createAutoConnectorMachine(minimalDeps()));

    sm.send({ type: 'AUTO.RESTART', parameters });

    expect(sm.state).not.toBe('idle');
  });
});
