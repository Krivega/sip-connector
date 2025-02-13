/// <reference types="jest" />
import { dataForConnectionWithoutAuthorization } from '../__fixtures__';
import UAmock from '../__fixtures__/UA.mock';
import { doMockSipConnector } from '../src/doMock';
import type SipConnector from '../src/SipConnector';

describe('checkTelephony', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = doMockSipConnector();
  });

  afterEach(() => {
    UAmock.setAvailableTelephony();
  });

  it('should be resolved request when telephony is ready', async () => {
    const uaTrigger = jest.spyOn(UAmock.prototype, 'trigger');

    // @ts-expect-error
    sipConnector.JsSIP.UA = UAmock;

    await sipConnector.checkTelephony(dataForConnectionWithoutAuthorization);

    expect(uaTrigger).toHaveBeenCalledTimes(3);
    expect(uaTrigger).toHaveBeenNthCalledWith(1, 'connected');
    expect(uaTrigger).toHaveBeenNthCalledWith(2, 'unregistered');
    expect(uaTrigger).toHaveBeenNthCalledWith(3, 'disconnected', { error: new Error('stoped') });
  });

  it('should fail request when telephony is not ready', async () => {
    UAmock.setNotAvailableTelephony();

    // @ts-expect-error
    sipConnector.JsSIP.UA = UAmock;

    let rejectedError = new Error('rejectedError');

    await sipConnector
      .checkTelephony(dataForConnectionWithoutAuthorization)
      .catch((error: unknown) => {
        rejectedError = error as Error;
      });

    expect(rejectedError.message).toBe('Telephony is not available');
  });
});
