/// <reference types="jest" />
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { doMockSipConnector } from '../doMock';

describe('disconnect', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  it('authorization user', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isConfigured()).toBe(true);

    await sipConnector.disconnect();

    expect(sipConnector.isConfigured()).toBe(false);
  });
});
