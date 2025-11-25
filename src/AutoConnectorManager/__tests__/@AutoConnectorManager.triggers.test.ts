import { doMockSipConnector } from '@/doMock';
import AutoConnectorManager from '../@AutoConnectorManager';
import CheckTelephonyRequester from '../CheckTelephonyRequester';
import PingServerIfNotActiveCallRequester from '../PingServerIfNotActiveCallRequester';
import RegistrationFailedOutOfCallSubscriber from '../RegistrationFailedOutOfCallSubscriber';

import type { SipConnector } from '@/SipConnector';
import type {
  IAutoConnectorOptions,
  TNetworkInterfacesSubscriber,
  TParametersAutoConnect,
} from '../types';

jest.mock('@/logger', () => {
  return jest.fn();
});

describe('AutoConnectorManager - Triggers', () => {
  let sipConnector: SipConnector;
  let manager: AutoConnectorManager;
  let onBeforeRetryMock: jest.Mock;

  const parameters = {
    displayName: 'Test User',
    sipServerUrl: 'sip://test.com',
    sipWebSocketServerURL: 'wss://test.com',
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

  let emitChangeNetworkInterfacesMock: (() => void) | undefined;
  let emitRemoveNetworkInterfacesMock: (() => void) | undefined;

  const networkInterfacesSubscriberMock: TNetworkInterfacesSubscriber = {
    subscribe: jest.fn(({ onChange, onRemove }: { onChange: () => void; onRemove: () => void }) => {
      emitChangeNetworkInterfacesMock = onChange;
      emitRemoveNetworkInterfacesMock = onRemove;
    }),
    unsubscribe: jest.fn(),
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
      networkInterfacesSubscriber: networkInterfacesSubscriberMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // @ts-ignore приватное свойство
    manager.attemptsState.limitInner = 30;
  });

  describe('подписчики и триггеры', () => {
    it('запускает ping server requester после успешного подключения', async () => {
      const pingServerIfNotActiveCallStartSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'start',
      );

      manager.start(baseParameters);

      await manager.wait('success');

      expect(pingServerIfNotActiveCallStartSpy).toHaveBeenCalledWith({
        onFailRequest: expect.any(Function) as () => void,
      });
    });

    it('подписывается на networkInterfacesSubscriber после успешного подключения', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      expect(networkInterfacesSubscriberMock.subscribe).toHaveBeenCalledWith({
        onChange: expect.any(Function) as () => void,
        onRemove: expect.any(Function) as () => void,
      });
    });

    it('отписывается от networkInterfacesSubscriber после остановки подключения', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      manager.stop();

      expect(networkInterfacesSubscriberMock.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('перезапускает ping server requester после смены сетевого интерфейса', async () => {
      const pingServerIfNotActiveCallStartSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'start',
      );
      const pingServerIfNotActiveCallStopSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'stop',
      );

      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitChangeNetworkInterfacesMock?.();

      expect(pingServerIfNotActiveCallStopSpy).toHaveBeenCalledTimes(1);
      expect(pingServerIfNotActiveCallStartSpy).toHaveBeenCalledWith({
        onFailRequest: expect.any(Function) as () => void,
      });
    });

    it('останавливает ping server requester после смены сетевого интерфейса', async () => {
      const pingServerIfNotActiveCallStopSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'stop',
      );

      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitRemoveNetworkInterfacesMock?.();

      expect(pingServerIfNotActiveCallStopSpy).toHaveBeenCalled();
    });

    it('подписывается на registration failed out of call после подключения', async () => {
      const registrationFailedSubscriberSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'subscribe',
      );

      manager.start(baseParameters);

      await manager.wait('success');

      expect(registrationFailedSubscriberSpy).toHaveBeenCalledWith(
        expect.any(Function) as () => void,
      );
    });

    it('запускает start при onFailRequest в ping server', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const startSpy = jest
        .spyOn(PingServerIfNotActiveCallRequester.prototype, 'start')
        .mockImplementation();

      manager.start(baseParameters);

      await manager.wait('success');

      const { onFailRequest } = startSpy.mock.calls[0][0] as {
        onFailRequest: () => void;
      };

      expect(connectSpy).toHaveBeenCalledTimes(1);

      onFailRequest();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('запускает start при срабатывании registration failed out of call', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');
      const subscribeSpy = jest
        .spyOn(RegistrationFailedOutOfCallSubscriber.prototype, 'subscribe')
        .mockImplementation();

      manager.start(baseParameters);

      await manager.wait('success');

      const [callback] = subscribeSpy.mock.calls[0] as [() => void];

      expect(connectSpy).toHaveBeenCalledTimes(1);

      callback();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('stopConnectTriggers: останавливает все триггеры', () => {
      const pingServerIfNotActiveCallStopSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'stop',
      );
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      // @ts-expect-error
      manager.stopConnectTriggers();

      expect(pingServerIfNotActiveCallStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('остановка всех триггеров в начале подключения', () => {
      // @ts-expect-error
      const stopConnectTriggersSpy = jest.spyOn(manager, 'stopConnectTriggers');

      manager.start(baseParameters);

      // 1-й раз останавливаются при вызове cancel в start
      expect(stopConnectTriggersSpy).toHaveBeenCalledTimes(2);
    });

    it('остановка всех триггеров успешной проверки телефонии', () => {
      jest.spyOn(sipConnector.connectionManager, 'isFailed', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isIdle', 'get').mockReturnValue(false);

      // @ts-expect-error
      const stopConnectTriggersSpy = jest.spyOn(manager, 'stopConnectTriggers');
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      const { onSuccessRequest } = startSpy.mock.calls[0][0] as {
        onSuccessRequest: () => void;
      };

      jest.clearAllMocks();

      onSuccessRequest();

      expect(stopConnectTriggersSpy).toHaveBeenCalledTimes(1);
    });
  });
});
