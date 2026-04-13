import flushPromises from '@/__fixtures__/flushPromises';
import { createNotReadyForConnectionError } from '@/ConnectionManager';
import { doMockSipConnector } from '@/doMock';
import AutoConnectorManager from '../@AutoConnectorManager';
import PingServerIfNotActiveCallRequester from '../PingServerIfNotActiveCallRequester';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

import type { SipConnector } from '@/SipConnector';
import type { IAutoConnectorOptions, TParametersAutoConnect } from '../types';

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('AutoConnectorManager - Connection', () => {
  let sipConnector: SipConnector;
  let manager: AutoConnectorManager;

  const parameters = {
    displayName: 'Test User',
    sipServerIp: 'sip://test.com',
    sipServerUrl: 'wss://test.com',
    register: false,
  };

  const getConnectParametersMock = async () => {
    return parameters;
  };

  let baseParameters: TParametersAutoConnect;

  const createManager = (options?: IAutoConnectorOptions) => {
    return new AutoConnectorManager(
      {
        connectionQueueManager: sipConnector.connectionQueueManager,
        connectionManager: sipConnector.connectionManager,
        callManager: sipConnector.callManager,
      },
      options,
    );
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    baseParameters = {
      getParameters: getConnectParametersMock,
    };

    manager = createManager({
      timeoutBetweenAttempts: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('подключение', () => {
    it('вызывает connect с данными из getParameters', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      manager.start(baseParameters);

      await flushPromises();

      const getParameters = connectSpy.mock.calls[0][0] as TParametersAutoConnect['getParameters'];

      const result = await getParameters();

      expect(result).toEqual(parameters);
    });

    it('должен вызывать stop-attempts-by-error и подписываться на слушателей при ошибке not ready for connection', async () => {
      expect.assertions(3);

      const pingServerIfNotActiveCallStartSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'start',
      );
      const registrationFailedSubscriberSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'subscribe',
      );
      const connectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'connect');

      manager.start({
        getParameters: baseParameters.getParameters,
        options: {
          hasReadyForConnection: () => {
            return false;
          },
        },
      });

      await manager.wait('stop-attempts-by-error');

      const connectResult = connectSpy.mock.results[0].value as Promise<Error>;

      expect(pingServerIfNotActiveCallStartSpy).not.toHaveBeenCalled();
      expect(registrationFailedSubscriberSpy).not.toHaveBeenCalled();

      await expect(connectResult).rejects.toThrow(createNotReadyForConnectionError());
    });
  });
});
