/// <reference types="jest" />
import { dataForConnectionWithAuthorization } from '../../__fixtures__';
import jssip from '../../__fixtures__/jssip.mock';
import type { TJsSIP } from '../../types';
import ConnectionManager from '../@ConnectionManager';

describe('disconnect', () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });
  });

  it('должен отключать пользователя с авторизацией', async () => {
    expect.assertions(2);

    await connectionManager.connect(dataForConnectionWithAuthorization);

    expect(connectionManager.isConfigured()).toBe(true);

    await connectionManager.disconnect();

    expect(connectionManager.isConfigured()).toBe(false);
  });
});
