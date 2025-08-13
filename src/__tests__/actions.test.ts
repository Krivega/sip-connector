/// <reference types="jest" />
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import { doMockSipConnector } from '../doMock';

import type { SipConnector } from '../SipConnector';

describe('actions', () => {
  let sipConnector: SipConnector;
  let mockFunction = jest.fn();

  beforeEach(() => {
    sipConnector = doMockSipConnector();
    mockFunction = jest.fn();
  });

  it('unregister', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    const unregistered = new Promise((resolve) => {
      sipConnector.once('connection:unregistered', resolve);
    });

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    sipConnector.unregister();

    return expect(unregistered).resolves.toEqual({
      response: { reason_phrase: 'OK', status_code: 200 },
    });
  });

  it('tryRegister', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    sipConnector.on('connection:unregistered', mockFunction);
    sipConnector.on('connection:connected', mockFunction);

    return sipConnector.tryRegister().then(() => {
      expect(mockFunction).toHaveBeenCalledTimes(2);
    });
  });
});
