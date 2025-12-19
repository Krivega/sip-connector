import flushPromises from '@/__fixtures__/flushPromises';
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
  TResumeFromSleepModeSubscriber,
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

  let emitChangeNetworkInterfacesMock: (() => void) | undefined;
  let emitUnavailableInterfacesMock: (() => void) | undefined;

  const networkInterfacesSubscriberMock: TNetworkInterfacesSubscriber = {
    subscribe: jest.fn(
      ({ onChange, onUnavailable }: { onChange: () => void; onUnavailable: () => void }) => {
        emitChangeNetworkInterfacesMock = onChange;
        emitUnavailableInterfacesMock = onUnavailable;
      },
    ),
    unsubscribe: jest.fn(),
  };

  let emitResumeMock: (() => void) | undefined;

  const resumeFromSleepModeSubscriberMock: TResumeFromSleepModeSubscriber = {
    subscribe: jest.fn(({ onResume }: { onResume: () => void }) => {
      emitResumeMock = onResume;
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
      resumeFromSleepModeSubscriber: resumeFromSleepModeSubscriberMock,
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

    it('подписывается на resumeFromSleepModeSubscriber после успешного подключения', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      expect(resumeFromSleepModeSubscriberMock.subscribe).toHaveBeenCalledWith({
        onResume: expect.any(Function) as () => void,
      });
    });

    it('отписывается от resumeFromSleepModeSubscriber после остановки подключения', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      manager.stop();

      expect(resumeFromSleepModeSubscriberMock.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('перезапускает auto connector manager при resumeFromSleepModeSubscriber onResume', async () => {
      // @ts-expect-error - доступ к приватному методу
      const activateAutoConnectorManager = jest.spyOn(manager, 'restartConnectionAttempts');

      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitResumeMock?.();

      expect(activateAutoConnectorManager).toHaveBeenCalledTimes(1);
    });

    it('не отписывается от resumeFromSleepModeSubscriber при перезапуске auto connector manager', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitResumeMock?.();

      expect(resumeFromSleepModeSubscriberMock.unsubscribe).toHaveBeenCalledTimes(0);
    });

    it('перезапускает auto connector manager при resumeFromSleepModeSubscriber onResume до наступления success', async () => {
      // @ts-expect-error - доступ к приватному методу
      const activateAutoConnectorManager = jest.spyOn(manager, 'restartConnectionAttempts');

      manager.start(baseParameters);

      expect(activateAutoConnectorManager).toHaveBeenCalledTimes(1);

      emitResumeMock?.();

      expect(activateAutoConnectorManager).toHaveBeenCalledTimes(2);
    });

    it('подписывается на networkInterfacesSubscriber после успешного подключения', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      expect(networkInterfacesSubscriberMock.subscribe).toHaveBeenCalledWith({
        onChange: expect.any(Function) as () => void,
        onUnavailable: expect.any(Function) as () => void,
      });
    });

    it('отписывается от networkInterfacesSubscriber после остановки подключения', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      manager.stop();

      expect(networkInterfacesSubscriberMock.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('перезапускает auto connector manager после смены сетевого интерфейса', async () => {
      // @ts-expect-error - доступ к приватному методу
      const activateAutoConnectorManager = jest.spyOn(manager, 'restartConnectionAttempts');

      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitChangeNetworkInterfacesMock?.();

      expect(activateAutoConnectorManager).toHaveBeenCalledTimes(1);
    });

    it('вызывает stopConnectionFlow после удаления всех сетевых интерфейсов', async () => {
      const stopConnectionFlowSpy = jest.spyOn(
        AutoConnectorManager.prototype,
        // @ts-expect-error - приватный метод
        'stopConnectionFlow',
      );

      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitUnavailableInterfacesMock?.();

      expect(stopConnectionFlowSpy).toHaveBeenCalled();
    });

    it('перезапускает auto connector manager после удаления всех сетевых интерфейсов и восстановления нового сетевого интерфейса', async () => {
      // @ts-expect-error - доступ к приватному методу
      const activateAutoConnectorManager = jest.spyOn(manager, 'restartConnectionAttempts');

      manager.start(baseParameters);

      await manager.wait('success');

      emitUnavailableInterfacesMock?.();

      jest.clearAllMocks();

      emitChangeNetworkInterfacesMock?.();

      expect(activateAutoConnectorManager).toHaveBeenCalled();
    });

    it('не отписывается от networkInterfacesSubscriber при перезапуске auto connector manager', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitChangeNetworkInterfacesMock?.();

      expect(networkInterfacesSubscriberMock.unsubscribe).toHaveBeenCalledTimes(0);
    });

    it('перезапускает auto connector manager при networkInterfacesSubscriber onChange до наступления success', async () => {
      // @ts-expect-error - доступ к приватному методу
      const activateAutoConnectorManager = jest.spyOn(manager, 'restartConnectionAttempts');

      manager.start(baseParameters);

      expect(activateAutoConnectorManager).toHaveBeenCalledTimes(1);

      emitChangeNetworkInterfacesMock?.();

      expect(activateAutoConnectorManager).toHaveBeenCalledTimes(2);
    });

    it('останавливает auto connector manager при networkInterfacesSubscriber onUnavailable до наступления success', async () => {
      // @ts-expect-error - доступ к приватному методу
      const activateAutoConnectorManager = jest.spyOn(manager, 'restartConnectionAttempts');
      // @ts-expect-error - доступ к приватному методу
      const stopConnectionFlowAutoConnectorManager = jest.spyOn(manager, 'stopConnectionFlow');

      manager.start(baseParameters);

      expect(activateAutoConnectorManager).toHaveBeenCalledTimes(1);
      expect(stopConnectionFlowAutoConnectorManager).toHaveBeenCalledTimes(1);

      emitUnavailableInterfacesMock?.();

      expect(activateAutoConnectorManager).toHaveBeenCalledTimes(1);
      expect(stopConnectionFlowAutoConnectorManager).toHaveBeenCalledTimes(2);
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

    it('остановка всех триггеров в начале подключения', async () => {
      // @ts-expect-error
      const stopConnectTriggersSpy = jest.spyOn(manager, 'stopConnectTriggers');

      manager.start(baseParameters);

      await flushPromises();

      // 1-й раз останавливаются при вызове cancel в start
      expect(stopConnectTriggersSpy).toHaveBeenCalledTimes(2);
    });

    it('остановка всех триггеров успешной проверки телефонии', async () => {
      jest.spyOn(sipConnector.connectionManager, 'isFailed', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isIdle', 'get').mockReturnValue(false);

      // @ts-expect-error
      const stopConnectTriggersSpy = jest.spyOn(manager, 'stopConnectTriggers');
      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();

      // @ts-ignore приватное свойство
      manager.attemptsState.limitInner = 0;

      manager.start(baseParameters);

      await flushPromises();

      const { onSuccessRequest } = startSpy.mock.calls[0][0] as {
        onSuccessRequest: () => void;
      };

      jest.clearAllMocks();

      onSuccessRequest();

      expect(stopConnectTriggersSpy).toHaveBeenCalledTimes(1);
    });
  });
});
