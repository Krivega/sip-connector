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

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('api:account:changed', (data) => {
        expect(data).toBe(undefined);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, accountChangedHeaders);
    });
  });

  it('event account:deleted', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    return new Promise<void>((resolve) => {
      sipConnector.on('api:account:deleted', (data) => {
        expect(data).toBe(undefined);

        resolve();
      });

      JsSIP.triggerNewSipEvent(ua, accountDeletedHeaders);
    });
  });
});
