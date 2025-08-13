/// <reference types="jest" />
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('disconnect', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  it('должен отключать пользователя с авторизацией', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isConfigured()).toBe(true);

    await sipConnector.disconnect();

    expect(sipConnector.isConfigured()).toBe(false);
  });
});
