import createSipConnector from '../__mocks__/doMock';
import { dataForConnectionWithAuthorization } from '../__mocks__';
import type SipConnector from '../SipConnector';

describe('actions', () => {
  let sipConnector: SipConnector;
  let mockFn;

  beforeEach(() => {
    sipConnector = createSipConnector();
    mockFn = jest.fn();
  });

  it.only('unregister', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    const unregistered = new Promise((resolve) => {
      sipConnector.once('unregistered', resolve);
    });

    sipConnector.unregister();

    return expect(unregistered).resolves.toEqual(undefined);
  });

  it('tryRegister', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    sipConnector.on('unregistered', mockFn);
    sipConnector.on('connecting', mockFn);
    sipConnector.on('connected', mockFn);

    return sipConnector.tryRegister().then(() => {
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });
});
