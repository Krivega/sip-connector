/// <reference types="jest" />
import type SipConnector from '../SipConnector';
import { dataForConnectionWithAuthorization } from '../__fixtures__';
import createSipConnector from '../doMock';

describe('actions', () => {
  let sipConnector: SipConnector;
  let mockFunction = jest.fn();

  beforeEach(() => {
    sipConnector = createSipConnector();
    mockFunction = jest.fn();
  });

  it('unregister', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    const unregistered = new Promise((resolve) => {
      sipConnector.once('unregistered', resolve);
    });

    sipConnector.unregister();

    return expect(unregistered).resolves.toEqual(undefined);
  });

  it('tryRegister', async () => {
    await sipConnector.connect(dataForConnectionWithAuthorization);

    sipConnector.on('unregistered', mockFunction);
    sipConnector.on('connecting', mockFunction);
    sipConnector.on('connected', mockFunction);

    return sipConnector.tryRegister().then(() => {
      expect(mockFunction).toHaveBeenCalledTimes(3);
    });
  });
});
