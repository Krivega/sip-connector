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
  let onBeforeRetryMock: jest.Mock;

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
    onBeforeRetryMock = jest.fn().mockResolvedValue(undefined);

    baseParameters = {
      getParameters: getConnectParametersMock,
    };

    manager = createManager({
      onBeforeRetry: onBeforeRetryMock,
      timeoutBetweenAttempts: 100,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // @ts-ignore приватное свойство
    manager.attemptsState.limitInner = 30;
  });

  describe('подключение', () => {
    it('вызывает connect с данными из getParameters', async () => {
      // @ts-expect-error приватное свойство
      const connectSpy = jest.spyOn(manager.connectionQueueManager, 'connect');

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
      // @ts-ignore приватное свойство
      const connectSpy = jest.spyOn(manager.connectionQueueManager, 'connect');

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
