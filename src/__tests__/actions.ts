import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import { EUaJSSIPEventNames } from '../events'
import type SipConnector from '../SipConnector';

describe('actions', () => {
  let sipConnector: SipConnector;
  let mockFn;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mockFn = jest.fn();
  });

  it('unregister', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    const unregistered = new Promise((resolve) => {
      sipConnector.once(EUaJSSIPEventNames.unregistered, resolve);
    });

    sipConnector.unregister();

    return expect(unregistered).resolves.toEqual(undefined);
  });

  it('tryRegister', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    sipConnector.on(EUaJSSIPEventNames.unregistered, mockFn);
    sipConnector.on(EUaJSSIPEventNames.connecting, mockFn);
    sipConnector.on(EUaJSSIPEventNames.connected, mockFn);

    return sipConnector.tryRegister().then(() => {
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });
});
