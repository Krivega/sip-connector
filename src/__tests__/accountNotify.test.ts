/// <reference types="jest" />
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { accountChangedHeaders, accountDeletedHeaders } from '../__fixtures__/accountNotify';
import JsSIP from '../__fixtures__/jssip.mock';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('account notify', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  it('event account:changed', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const promise = new Promise<void>((resolve, reject) => {
      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      sipConnector.on('api:account:changed', () => {
        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, accountChangedHeaders);
    });

    await expect(promise).resolves.toBeUndefined();
  });

  it('event account:deleted', async () => {
    expect.assertions(1);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const promise = new Promise<void>((resolve, reject) => {
      const { ua } = sipConnector.connectionManager;

      if (!ua) {
        reject(new Error('UA not initialized'));

        return;
      }

      sipConnector.on('api:account:deleted', () => {
        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, accountDeletedHeaders);
    });

    await expect(promise).resolves.toBeUndefined();
  });
});
