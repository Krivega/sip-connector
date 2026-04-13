import flushPromises from '@/__fixtures__/flushPromises';
import { doMockSipConnector } from '@/doMock';
import AutoConnectorManager from '../@AutoConnectorManager';
import AttemptsState from '../AttemptsState';
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

    baseParameters = {
      getParameters: getConnectParametersMock,
    };

    manager = createManager({
      timeoutBetweenAttempts: 100,
      networkInterfacesSubscriber: networkInterfacesSubscriberMock,
      resumeFromSleepModeSubscriber: resumeFromSleepModeSubscriberMock,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
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
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');

      manager.start(baseParameters);

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(1);

      emitResumeMock?.();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('схлопывает повторные onResume в коротком окне', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');

      manager.start(baseParameters);

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(1);

      emitResumeMock?.();
      emitResumeMock?.();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('не отписывается от resumeFromSleepModeSubscriber при перезапуске auto connector manager', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitResumeMock?.();

      expect(resumeFromSleepModeSubscriberMock.unsubscribe).toHaveBeenCalledTimes(0);
    });

    it('перезапускает auto connector manager при resumeFromSleepModeSubscriber onResume до наступления success', async () => {
      const beforeAttemptHandler = jest.fn();

      manager.on('before-attempt', beforeAttemptHandler);

      manager.start(baseParameters);

      await flushPromises();

      emitResumeMock?.();

      await flushPromises();

      expect(beforeAttemptHandler.mock.calls.length).toBeGreaterThanOrEqual(2);
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
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');

      manager.start(baseParameters);

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(1);

      emitChangeNetworkInterfacesMock?.();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('схлопывает повторные onChange по одному интерфейсу в коротком окне', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');

      manager.start(baseParameters);

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(1);

      emitChangeNetworkInterfacesMock?.();
      emitChangeNetworkInterfacesMock?.();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('подавляет менее приоритетную причину в окне coalescing', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');

      manager.start(baseParameters);

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(1);

      emitChangeNetworkInterfacesMock?.(); // network-change, высокий приоритет
      emitResumeMock?.(); // sleep-resume, ниже приоритет

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('пропускает более приоритетную причину в окне coalescing', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');

      manager.start(baseParameters);

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(1);

      emitResumeMock?.(); // sleep-resume, ниже приоритет
      emitChangeNetworkInterfacesMock?.(); // network-change, выше приоритет

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it('вызывает stopConnectionFlow после удаления всех сетевых интерфейсов', async () => {
      const disconnectSpy = jest.spyOn(sipConnector.connectionQueueManager, 'disconnect');

      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitUnavailableInterfacesMock?.();

      await flushPromises();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('перезапускает auto connector manager после удаления всех сетевых интерфейсов и восстановления нового сетевого интерфейса', async () => {
      const connectSpy = jest.spyOn(sipConnector.connectionManager, 'connect');

      manager.start(baseParameters);

      await manager.wait('success');

      emitUnavailableInterfacesMock?.();

      jest.clearAllMocks();

      emitChangeNetworkInterfacesMock?.();

      await manager.wait('success');

      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('не отписывается от networkInterfacesSubscriber при перезапуске auto connector manager', async () => {
      manager.start(baseParameters);

      await manager.wait('success');

      jest.clearAllMocks();

      emitChangeNetworkInterfacesMock?.();

      expect(networkInterfacesSubscriberMock.unsubscribe).toHaveBeenCalledTimes(0);
    });

    it('перезапускает auto connector manager при networkInterfacesSubscriber onChange до наступления success', async () => {
      const beforeAttemptHandler = jest.fn();

      manager.on('before-attempt', beforeAttemptHandler);

      manager.start(baseParameters);

      await flushPromises();

      emitChangeNetworkInterfacesMock?.();

      await flushPromises();

      expect(beforeAttemptHandler.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('останавливает auto connector manager при networkInterfacesSubscriber onUnavailable до наступления success', async () => {
      manager.start(baseParameters);

      expect(manager.stateMachine.state).toBe('disconnecting');

      emitUnavailableInterfacesMock?.();

      await flushPromises();

      expect(['idle', 'disconnecting']).toContain(manager.stateMachine.state);
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

    it('stop: останавливает все connect triggers', async () => {
      const pingServerIfNotActiveCallStopSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'stop',
      );
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      manager.start(baseParameters);
      await manager.wait('success');

      jest.clearAllMocks();
      manager.stop();

      expect(pingServerIfNotActiveCallStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('в начале подключения сбрасывает connect triggers через инфраструктуру', async () => {
      const pingServerIfNotActiveCallStopSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'stop',
      );
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );

      manager.start(baseParameters);

      await flushPromises();

      expect(pingServerIfNotActiveCallStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberUnsubscribeSpy).toHaveBeenCalled();
    });

    it('остановка всех триггеров успешной проверки телефонии', async () => {
      jest.spyOn(sipConnector.connectionManager, 'isDisconnected', 'get').mockReturnValue(false);
      jest.spyOn(sipConnector.connectionManager, 'isIdle', 'get').mockReturnValue(false);

      const startSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'start').mockImplementation();
      const pingServerIfNotActiveCallStopSpy = jest.spyOn(
        PingServerIfNotActiveCallRequester.prototype,
        'stop',
      );
      const checkTelephonyStopSpy = jest.spyOn(CheckTelephonyRequester.prototype, 'stop');
      const registrationFailedSubscriberUnsubscribeSpy = jest.spyOn(
        RegistrationFailedOutOfCallSubscriber.prototype,
        'unsubscribe',
      );
      const hasLimitReachedSpy = jest
        .spyOn(AttemptsState.prototype, 'hasLimitReached')
        .mockImplementation(() => {
          return true;
        });

      manager.start(baseParameters);

      await flushPromises();

      const { onSuccessRequest } = startSpy.mock.calls[0][1] as {
        onSuccessRequest: () => void;
      };

      jest.clearAllMocks();

      onSuccessRequest();

      expect(pingServerIfNotActiveCallStopSpy).toHaveBeenCalled();
      expect(checkTelephonyStopSpy).toHaveBeenCalled();
      expect(registrationFailedSubscriberUnsubscribeSpy).toHaveBeenCalled();

      hasLimitReachedSpy.mockRestore();
    });
  });
});
