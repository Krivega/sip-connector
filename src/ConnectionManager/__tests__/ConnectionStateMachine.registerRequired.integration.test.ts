import jssip from '@/__fixtures__/jssip.mock';
import UAMock, { PASSWORD_CORRECT } from '@/__fixtures__/UA.mock';
import ConnectionManager from '../@ConnectionManager';
import { applyRegisterRequiredFromMachineEvent, EEvents } from '../ConnectionStateMachine';

import type { TJsSIP } from '@/types';

jest.setTimeout(5000);

describe('ConnectionStateMachine registerRequired (integration)', () => {
  const SIP_SERVER_URL = 'sip.example.com';
  const WS_DOMAIN = 'sip.example.com:8089';

  beforeEach(() => {
    UAMock.reset();
  });

  it('после connect с register=true контекст машины содержит registerRequired: true', async () => {
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

    expect(connectionManager.stateMachine.context.registerRequired).toBe(true);

    connectionManager.destroy();
  });

  it('applyRegisterRequiredFromMachineEvent: не-START_INIT_UA события дают пустой partial (ветка защиты)', () => {
    expect(applyRegisterRequiredFromMachineEvent({ type: EEvents.UA_CONNECTED })).toEqual({});
    expect(applyRegisterRequiredFromMachineEvent({ type: EEvents.RESET })).toEqual({});
    expect(applyRegisterRequiredFromMachineEvent({ type: EEvents.START_CONNECT })).toEqual({});
  });

  it('applyRegisterRequiredFromMachineEvent: START_INIT_UA задаёт registerRequired', () => {
    expect(
      applyRegisterRequiredFromMachineEvent({
        type: EEvents.START_INIT_UA,
        registerRequired: true,
      }),
    ).toEqual({ registerRequired: true });
  });
});
