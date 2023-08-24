import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../__fixtures__/doMock';

describe('disconnect', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = createSipConnector();
  });

  it('authorization user', async () => {
    expect.assertions(2);

    await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.isConfigured()).toBe(true);

    await sipConnector.disconnect();

    expect(sipConnector.isConfigured()).toBe(false);
  });
});
