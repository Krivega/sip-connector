import jssip from '@/__fixtures__/jssip.mock';
import UAMock, { PASSWORD_CORRECT } from '@/__fixtures__/UA.mock';
import ConnectionManager from '../@ConnectionManager';

import type { TJsSIP } from '@/types';

jest.setTimeout(5000);

describe('ConnectionStateMachine configuration (integration)', () => {
  const SIP_SERVER_URL = 'sip.example.com';
  const WS_DOMAIN = 'sip.example.com:8089';

  beforeEach(() => {
    UAMock.reset();
  });

  it('после connect с register=true конфигурация сохраняется в контексте машины', async () => {
    const connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });

    await connectionManager.connect({
      displayName: 'Test User',
      user: 'testuser',
      password: PASSWORD_CORRECT,
      register: true,
      sipServerIp: SIP_SERVER_URL,
      sipServerUrl: WS_DOMAIN,
    });

    expect(connectionManager.stateMachine.context.connectionConfiguration).toEqual(
      expect.objectContaining({
        register: true,
        displayName: 'Test User',
        sipServerIp: SIP_SERVER_URL,
        sipServerUrl: WS_DOMAIN,
      }),
    );

    connectionManager.destroy();
  });

  it('после успешного connect disconnect очищает конфигурацию через reset', async () => {
    const connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });

    await connectionManager.connect({
      displayName: 'Test User',
      user: 'testuser',
      password: PASSWORD_CORRECT,
      register: true,
      sipServerIp: SIP_SERVER_URL,
      sipServerUrl: WS_DOMAIN,
    });

    expect(connectionManager.getConnectionConfiguration()).toBeDefined();

    await connectionManager.disconnect();

    expect(connectionManager.getConnectionConfiguration()).toBeUndefined();
    expect(connectionManager.stateMachine.isRegisterEnabled()).toBe(false);

    connectionManager.destroy();
  });
});
