import { C as JsSIP_C } from '@krivega/jssip';

import flushPromises from '@/__fixtures__/flushPromises';
import { doMockSipConnector } from '@/doMock';
import CallSignalingRecovery from '../CallSignalingRecovery';
import PingServerRequester from '../PingServerRequester';

import type { ConnectedEvent } from '@krivega/jssip';

const serverRespondedError = { originator: 'remote', cause: JsSIP_C.causes.SIP_FAILURE_CODE };
const pingTimeoutError = { originator: 'system', cause: JsSIP_C.causes.REQUEST_TIMEOUT };
const connectionError = { originator: 'system', cause: JsSIP_C.causes.CONNECTION_ERROR };

const startMock = jest.fn(async () => {});
const stopMock = jest.fn();

jest.mock('@krivega/timeout-requester', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    ...jest.requireActual('@krivega/timeout-requester'),
    resolveRequesterByTimeout: jest.fn(() => {
      return {
        start: startMock,
        stop: stopMock,
      };
    }),
  };
});

describe('CallSignalingRecovery', () => {
  let pingServerRequester: PingServerRequester;
  let callSignalingRecovery: CallSignalingRecovery;
  let sipConnector: ReturnType<typeof doMockSipConnector>;
  let onFailRequest: jest.Mock;
  let onSignalingUnstable: jest.Mock;
  let onSignalingRestored: jest.Mock;
  let isCallActiveSpy: jest.SpyInstance;
  let reopenTransportSpy: jest.SpyInstance;
  let callbacks: { onFailRequest: (error?: unknown) => void; onSuccessRequest: () => void };

  const triggerTransportConnected = () => {
    sipConnector.connectionManager.events.trigger('connected', {} as ConnectedEvent);
  };

  // Та же связка, что и в AutoConnectorRuntime
  const start = () => {
    pingServerRequester.start({
      onFailRequest,
      onPingSucceeded: () => {
        callSignalingRecovery.onPingSucceeded();
      },
      onPingFailedInCall: (payload) => {
        callSignalingRecovery.onPingFailedInCall(payload);
      },
    });

    [, callbacks] = startMock.mock.calls[0] as unknown as [undefined, typeof callbacks];
  };

  const stop = () => {
    pingServerRequester.stop();
    callSignalingRecovery.stop();
  };

  beforeEach(() => {
    sipConnector = doMockSipConnector();

    jest.clearAllMocks();

    onFailRequest = jest.fn();
    onSignalingUnstable = jest.fn();
    onSignalingRestored = jest.fn();
    isCallActiveSpy = jest
      .spyOn(sipConnector.callManager, 'isCallActive', 'get')
      .mockReturnValue(true);
    reopenTransportSpy = jest
      .spyOn(sipConnector.connectionManager, 'reopenTransport')
      .mockImplementation(() => {});

    pingServerRequester = new PingServerRequester({
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
    });
    callSignalingRecovery = new CallSignalingRecovery({
      connectionManager: sipConnector.connectionManager,
      callManager: sipConnector.callManager,
      pingServerRequester,
      onSignalingUnstable,
      onSignalingRestored,
    });
  });

  describe('эпизод нестабильной сигнализации', () => {
    beforeEach(() => {
      start();
    });

    it('сообщает signaling-unstable один раз за эпизод с первого неуспешного ping', () => {
      callbacks.onFailRequest();

      expect(onSignalingUnstable).toHaveBeenCalledTimes(1);
      expect(onSignalingUnstable).toHaveBeenCalledWith({ failCount: 1 });

      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onSignalingUnstable).toHaveBeenCalledTimes(1);
      expect(onSignalingRestored).not.toHaveBeenCalled();
    });

    it('сообщает signaling-unstable до переоткрытия транспорта', () => {
      callbacks.onFailRequest();

      expect(onSignalingUnstable.mock.invocationCallOrder[0]).toBeLessThan(
        reopenTransportSpy.mock.invocationCallOrder[0],
      );
    });

    it('не сообщает signaling-unstable и signaling-restored вне звонка', () => {
      isCallActiveSpy.mockReturnValue(false);

      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      stop();

      expect(onFailRequest).toHaveBeenCalledTimes(1);
      expect(onSignalingUnstable).not.toHaveBeenCalled();
      expect(onSignalingRestored).not.toHaveBeenCalled();
    });

    it('сообщает signaling-restored один раз после успешного ping', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      callbacks.onSuccessRequest();

      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });

    it('сообщает signaling-restored до досылки по тому же успешному ping', () => {
      const renegotiateIfPendingSpy = jest
        .spyOn(sipConnector.callManager, 'renegotiateIfPending')
        .mockResolvedValue(true);

      callbacks.onFailRequest();
      callbacks.onSuccessRequest();

      expect(onSignalingRestored.mock.invocationCallOrder[0]).toBeLessThan(
        renegotiateIfPendingSpy.mock.invocationCallOrder[0],
      );
    });

    it('сообщает signaling-restored по успешному ping после завершения звонка', () => {
      callbacks.onFailRequest();
      isCallActiveSpy.mockReturnValue(false);
      callbacks.onSuccessRequest();

      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });

    it('сообщает signaling-restored один раз при остановке', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();
      stop();
      stop();

      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });

    it('не сообщает signaling-restored без предшествующего signaling-unstable', () => {
      callbacks.onSuccessRequest();
      stop();

      expect(onSignalingUnstable).not.toHaveBeenCalled();
      expect(onSignalingRestored).not.toHaveBeenCalled();
    });

    it('сообщает signaling-unstable повторно в новом эпизоде после восстановления', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onSuccessRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(onSignalingUnstable).toHaveBeenCalledTimes(2);
      expect(onSignalingUnstable).toHaveBeenLastCalledWith({ failCount: 1 });
      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });

    it('после завершения звонка запрашивает reconnect и сообщает signaling-restored при остановке', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      isCallActiveSpy.mockReturnValue(false);
      callbacks.onFailRequest();

      expect(onFailRequest).toHaveBeenCalledTimes(1);
      expect(onSignalingRestored).not.toHaveBeenCalled();

      stop();

      expect(onSignalingUnstable).toHaveBeenCalledTimes(1);
      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });
  });

  describe('восстановление транспорта по неуспешному ping в звонке', () => {
    beforeEach(() => {
      start();
    });

    it.each([
      ['таймаут', pingTimeoutError],
      ['ошибка транспорта', connectionError],
      ['ошибка неизвестной формы', new Error('UA not initialized')],
    ])(
      'переоткрывает транспорт по каждому неуспешному ping, если сервер не ответил: %s',
      (_name, error) => {
        callbacks.onFailRequest(error);
        callbacks.onFailRequest(error);

        expect(reopenTransportSpy).toHaveBeenCalledTimes(2);
        expect(onFailRequest).not.toHaveBeenCalled();
      },
    );

    it('не переоткрывает транспорт, если сервер ответил на ping ошибкой, но сообщает signaling-unstable', () => {
      callbacks.onFailRequest(serverRespondedError);
      triggerTransportConnected();

      expect(onSignalingUnstable).toHaveBeenCalledWith({ failCount: 1 });
      expect(reopenTransportSpy).not.toHaveBeenCalled();
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    it('не зацикливает переоткрытие, если сервер ответил ошибкой на ping по новому транспорту', () => {
      callbacks.onFailRequest(pingTimeoutError);
      triggerTransportConnected();

      expect(reopenTransportSpy).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledTimes(2);

      callbacks.onFailRequest(serverRespondedError);
      triggerTransportConnected();

      expect(reopenTransportSpy).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledTimes(2);
    });

    it('не переоткрывает транспорт по провалу ping сразу после подключения: следующее переоткрытие — по провалу ping цикла', () => {
      callbacks.onFailRequest(pingTimeoutError);
      triggerTransportConnected();

      expect(reopenTransportSpy).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledTimes(2);

      // Полученный ответ 408 JsSIP отдаёт как таймаут: `originator: 'system'`
      callbacks.onFailRequest(pingTimeoutError);
      triggerTransportConnected();

      expect(reopenTransportSpy).toHaveBeenCalledTimes(1);
      expect(startMock).toHaveBeenCalledTimes(2);

      callbacks.onFailRequest(pingTimeoutError);
      triggerTransportConnected();

      expect(reopenTransportSpy).toHaveBeenCalledTimes(2);
      expect(startMock).toHaveBeenCalledTimes(3);

      callbacks.onFailRequest(pingTimeoutError);

      expect(reopenTransportSpy).toHaveBeenCalledTimes(2);
      expect(onSignalingUnstable).toHaveBeenCalledTimes(1);
      expect(onSignalingRestored).not.toHaveBeenCalled();
    });

    it('переоткрывает транспорт по провалу ping, если ping по новому транспорту прошёл', () => {
      callbacks.onFailRequest(pingTimeoutError);
      triggerTransportConnected();
      callbacks.onSuccessRequest();
      callbacks.onFailRequest(pingTimeoutError);

      expect(reopenTransportSpy).toHaveBeenCalledTimes(2);
    });

    it('после остановки переоткрывает транспорт по первому провалу ping', () => {
      callbacks.onFailRequest(pingTimeoutError);
      triggerTransportConnected();
      callSignalingRecovery.stop();
      callbacks.onFailRequest(pingTimeoutError);

      expect(reopenTransportSpy).toHaveBeenCalledTimes(2);
    });

    it('сразу отправляет ping, как только транспорт снова подключён', () => {
      callbacks.onFailRequest();

      expect(startMock).toHaveBeenCalledTimes(1);

      triggerTransportConnected();

      expect(startMock).toHaveBeenCalledTimes(2);
      expect(startMock).toHaveBeenLastCalledWith(undefined, callbacks);

      triggerTransportConnected();

      expect(startMock).toHaveBeenCalledTimes(2);
    });

    it('ждёт одно подключение транспорта на несколько неуспешных ping', () => {
      callbacks.onFailRequest();
      callbacks.onFailRequest();
      triggerTransportConnected();

      expect(startMock).toHaveBeenCalledTimes(2);
    });

    it('не отправляет ping по подключению транспорта после остановки', () => {
      callbacks.onFailRequest();
      stop();
      triggerTransportConnected();

      expect(startMock).toHaveBeenCalledTimes(1);
    });

    it('stop отписывается от подключения транспорта', () => {
      const pingImmediatelySpy = jest.spyOn(pingServerRequester, 'pingImmediately');

      callbacks.onFailRequest();
      callSignalingRecovery.stop();
      triggerTransportConnected();

      expect(pingImmediatelySpy).not.toHaveBeenCalled();
    });

    it('не переоткрывает транспорт вне звонка', () => {
      isCallActiveSpy.mockReturnValue(false);

      callbacks.onFailRequest();
      callbacks.onFailRequest();
      callbacks.onFailRequest();

      expect(reopenTransportSpy).not.toHaveBeenCalled();
      expect(onFailRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitForSignaling', () => {
    const trackResult = (promise: Promise<boolean>) => {
      const result: { isReady?: boolean } = {};

      promise
        .then((isReady) => {
          result.isReady = isReady;
        })
        .catch(() => {});

      return result;
    };

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick'] });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('возвращает true без запущенного ping', async () => {
      await expect(callSignalingRecovery.waitForSignaling()).resolves.toBe(true);

      expect(startMock).not.toHaveBeenCalled();
    });

    it('возвращает true вне звонка', async () => {
      start();
      isCallActiveSpy.mockReturnValue(false);

      await expect(callSignalingRecovery.waitForSignaling()).resolves.toBe(true);

      expect(startMock).toHaveBeenCalledTimes(1);
    });

    it('отправляет ping общего цикла и по его успеху возвращает true, одновременные вызовы делят один ping', async () => {
      start();

      const checks = Promise.all([
        callSignalingRecovery.waitForSignaling(),
        callSignalingRecovery.waitForSignaling(),
      ]);

      expect(startMock).toHaveBeenCalledTimes(2);
      expect(startMock).toHaveBeenLastCalledWith(undefined, callbacks);

      callbacks.onSuccessRequest();

      await expect(checks).resolves.toEqual([true, true]);

      const result = trackResult(callSignalingRecovery.waitForSignaling());

      expect(startMock).toHaveBeenCalledTimes(3);

      callbacks.onSuccessRequest();
      await flushPromises();

      expect(result.isReady).toBe(true);
    });

    it('провал ping проверки обрабатывает как провал цикла и ждёт успешного ping по новому транспорту', async () => {
      start();

      const result = trackResult(callSignalingRecovery.waitForSignaling());

      callbacks.onFailRequest();
      await flushPromises();

      expect(onSignalingUnstable).toHaveBeenCalledWith({ failCount: 1 });
      expect(reopenTransportSpy).toHaveBeenCalledTimes(1);
      expect(result.isReady).toBeUndefined();

      triggerTransportConnected();

      expect(startMock).toHaveBeenCalledTimes(3);

      callbacks.onSuccessRequest();
      await flushPromises();

      expect(result.isReady).toBe(true);
      expect(onSignalingRestored).toHaveBeenCalledTimes(1);
    });

    it('при ответе сервера с ошибкой ждёт успешного ping без переоткрытия транспорта', async () => {
      start();

      const result = trackResult(callSignalingRecovery.waitForSignaling());

      callbacks.onFailRequest(serverRespondedError);
      await flushPromises();

      expect(onSignalingUnstable).toHaveBeenCalledWith({ failCount: 1 });
      expect(reopenTransportSpy).not.toHaveBeenCalled();
      expect(result.isReady).toBeUndefined();

      callbacks.onSuccessRequest();
      await flushPromises();

      expect(result.isReady).toBe(true);
    });

    it('возвращает false, если успешного ping нет 15 с', async () => {
      start();

      const result = trackResult(callSignalingRecovery.waitForSignaling());

      callbacks.onFailRequest();
      jest.advanceTimersByTime(14_999);
      await flushPromises();

      expect(result.isReady).toBeUndefined();

      jest.advanceTimersByTime(1);
      await flushPromises();

      expect(result.isReady).toBe(false);

      callbacks.onSuccessRequest();
      await flushPromises();

      expect(result.isReady).toBe(false);
    });

    it.each(['ended', 'failed'] as const)(
      'возвращает false, если звонок завершился (%s) во время ожидания',
      async (eventName) => {
        start();

        const promise = callSignalingRecovery.waitForSignaling();

        sipConnector.callManager.events.trigger(eventName, { originator: 'local' } as never);

        await expect(promise).resolves.toBe(false);
      },
    );

    it('возвращает false при остановке во время ожидания', async () => {
      start();

      const promise = callSignalingRecovery.waitForSignaling();

      stop();

      await expect(promise).resolves.toBe(false);
    });

    it('после завершения проверки снимает таймер и подписку на конец звонка', async () => {
      const { events } = sipConnector.callManager;
      const endedSubscribersCount = events.getSubscribersCount('ended');

      start();

      const promise = callSignalingRecovery.waitForSignaling();

      expect(events.getSubscribersCount('ended')).toBe(endedSubscribersCount + 1);
      expect(jest.getTimerCount()).toBe(1);

      callbacks.onSuccessRequest();

      await expect(promise).resolves.toBe(true);

      expect(events.getSubscribersCount('ended')).toBe(endedSubscribersCount);
      expect(jest.getTimerCount()).toBe(0);
    });

    describe('досылка неотправленной перенастройки', () => {
      let renegotiateIfPendingSpy: jest.SpyInstance;

      beforeEach(() => {
        renegotiateIfPendingSpy = jest
          .spyOn(sipConnector.callManager, 'renegotiateIfPending')
          .mockResolvedValue(true);
      });

      it('досылает по любому успешному ping, без signaling-restored', () => {
        start();
        callbacks.onSuccessRequest();

        expect(renegotiateIfPendingSpy).toHaveBeenCalledTimes(1);
        expect(onSignalingRestored).not.toHaveBeenCalled();
      });

      it('досылает и во время проверки сигнализации: проверка старта демонстрации не отправляет re-INVITE', async () => {
        start();

        const result = trackResult(callSignalingRecovery.waitForSignaling());

        callbacks.onSuccessRequest();

        expect(renegotiateIfPendingSpy).toHaveBeenCalledTimes(1);

        await flushPromises();

        expect(result.isReady).toBe(true);
      });

      it('не досылает по неуспешному ping', () => {
        start();
        callbacks.onFailRequest();

        expect(renegotiateIfPendingSpy).not.toHaveBeenCalled();
      });

      it('не прерывает ping при ошибке досылки', async () => {
        renegotiateIfPendingSpy.mockRejectedValue(new Error('Media Renegotiation Failed'));
        start();

        expect(() => {
          callbacks.onSuccessRequest();
        }).not.toThrow();

        await flushPromises();
        callbacks.onSuccessRequest();

        expect(renegotiateIfPendingSpy).toHaveBeenCalledTimes(2);
      });
    });
  });
});
