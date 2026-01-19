import { createMediaStreamMock } from 'webrtc-mock';

import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { CallManager } from '@/CallManager';
import { ConferenceStateManager } from '@/ConferenceStateManager';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import PresentationManager, { hasCanceledStartPresentationError } from '../@PresentationManager';

import type { TReachedLimitError } from 'repeated-calls';

describe('PresentationManager', () => {
  let callManager: CallManager;
  let rtcSession: RTCSessionMock;
  let manager: PresentationManager;
  let mediaStream: MediaStream;
  const beforeStartPresentation = jest.fn(async () => {});
  const beforeStopPresentation = jest.fn(async () => {});

  beforeEach(() => {
    rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'local',
    });
    callManager = new CallManager(new ConferenceStateManager(), new ContentedStreamManager());
    rtcSession.on('presentation:start', (data: MediaStream) => {
      callManager.events.trigger('presentation:start', data);
    });
    rtcSession.on('presentation:started', (data: MediaStream) => {
      callManager.events.trigger('presentation:started', data);
    });
    rtcSession.on('presentation:end', (data: MediaStream) => {
      callManager.events.trigger('presentation:end', data);
    });
    rtcSession.on('presentation:ended', (data: MediaStream) => {
      callManager.events.trigger('presentation:ended', data);
    });
    rtcSession.on('presentation:failed', (data: Error) => {
      callManager.events.trigger('presentation:failed', data);
    });
    callManager.getEstablishedRTCSession = jest.fn().mockReturnValue(rtcSession);
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });

    manager = new PresentationManager({
      callManager: callManager as unknown as CallManager,
    });
  });

  afterEach(() => {
    RTCSessionMock.resetPresentationError();
    rtcSession.clear();
    jest.clearAllMocks();
  });

  it('успешно стартует презентацию', async () => {
    const spy = jest.fn();

    manager.on('presentation:started', spy);

    const result = await manager.startPresentation(beforeStartPresentation, mediaStream);
    const { streamPresentationCurrent } = manager;

    expect(result).toBeDefined();
    expect(streamPresentationCurrent).toBeDefined();
    expect(result.id).toBe(mediaStream.id);

    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStream]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(streamPresentationCurrent?.id);
  });

  it('выбрасывает ошибку, если нет rtcSession', async () => {
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);
    await expect(manager.startPresentation(beforeStartPresentation, mediaStream)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('выбрасывает ошибку, если презентация уже запущена', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    await expect(manager.startPresentation(beforeStartPresentation, mediaStream)).rejects.toThrow(
      'Presentation is already started',
    );
  });

  it('успешно останавливает презентацию', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);

    const { streamPresentationCurrent } = manager;

    const spy = jest.fn();

    manager.on('presentation:ended', spy);

    const result = await manager.stopPresentation(beforeStopPresentation);

    if (!result) {
      throw new Error('result is undefined');
    }

    expect(result.id).toBe(streamPresentationCurrent?.id);
    expect(manager.streamPresentationCurrent).toBeUndefined();

    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStream]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(streamPresentationCurrent?.id);
  });

  it('корректно сбрасывает состояние после stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    await manager.stopPresentation(beforeStopPresentation);
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
    expect(manager.streamPresentationCurrent).toBeUndefined();
  });

  it('вызывает событие FAILED_PRESENTATION при ошибке stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);

    const testError = new Error('fail');

    RTCSessionMock.setPresentationError(testError);

    const spy = jest.fn();

    manager.on('presentation:failed', spy);

    await expect(manager.stopPresentation(beforeStopPresentation)).rejects.toThrow('fail');

    expect(spy).toHaveBeenCalledWith(testError);
  });

  it('вызывает событие FAILED_PRESENTATION в блоке catch при ошибке stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);

    const testError = new Error('fail-catch');

    RTCSessionMock.setPresentationError(testError);

    const spy = jest.fn();

    manager.on('presentation:failed', spy);

    await expect(manager.stopPresentation(beforeStopPresentation)).rejects.toThrow('fail-catch');

    expect(spy).toHaveBeenCalledWith(testError);
  });

  it('вызывает событие FAILED_PRESENTATION с new Error(String(error)) когда ошибка не является экземпляром Error в stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);

    // Устанавливаем ошибку, которая не является экземпляром Error (строка)
    const nonErrorValue = 'string-error-message';

    RTCSessionMock.setPresentationError(nonErrorValue as unknown as Error);

    const spy = jest.fn();

    manager.on('presentation:failed', spy);

    await expect(manager.stopPresentation(beforeStopPresentation)).rejects.toBe(nonErrorValue);

    // Проверяем, что событие было вызвано с новым Error, созданным из строки
    // Событие может вызываться несколько раз (из RTCSessionMock и из PresentationManager)
    expect(spy).toHaveBeenCalled();

    const calledErrors = (spy.mock.calls as [Error][]).map((call) => {
      return call[0] as Error;
    });

    // Проверяем, что хотя бы один вызов был с Error, созданным из строки (из PresentationManager)
    const hasConvertedError = calledErrors.some((error) => {
      return error instanceof Error && error.message === 'string-error-message';
    });

    expect(hasConvertedError).toBe(true);
  });

  it('вызывает событие ENDED_PRESENTATION если нет rtcSession при stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);

    const { streamPresentationCurrent } = manager;

    const spy = jest.fn();

    manager.on('presentation:ended', spy);
    await manager.stopPresentation(beforeStopPresentation);
    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStream]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(streamPresentationCurrent?.id);
  });

  it('вызывает событие ENDED_PRESENTATION когда есть streamPresentationPrevious но нет rtcSession', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);

    const { streamPresentationCurrent } = manager;

    // Устанавливаем rtcSession в undefined
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);

    const spy = jest.fn();

    manager.on('presentation:ended', spy);

    const result = await manager.stopPresentation(beforeStopPresentation);

    expect(result).toBeUndefined();
    expect(spy).toHaveBeenCalledWith(streamPresentationCurrent);
  });

  it('успешно обновляет презентацию', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);

    const { streamPresentationCurrent } = manager;

    const newStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId2' } },
      video: { deviceId: { exact: 'videoDeviceId2' } },
    });

    const spy = jest.fn();

    manager.on('presentation:started', spy);

    const result = await manager.updatePresentation(beforeStartPresentation, newStream);

    const { streamPresentationCurrent: streamPresentationCurrent2 } = manager;

    expect(result).toBeDefined();

    if (!result) {
      throw new Error('result is undefined');
    }

    if (!streamPresentationCurrent) {
      throw new Error('streamPresentationCurrent is undefined');
    }

    if (!streamPresentationCurrent2) {
      throw new Error('streamPresentationCurrent2 is undefined');
    }

    expect(streamPresentationCurrent.id).not.toBe(streamPresentationCurrent2.id);

    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStream]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(streamPresentationCurrent2.id);
  });

  it('выбрасывает ошибку при updatePresentation если нет rtcSession', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);
    await expect(manager.updatePresentation(beforeStartPresentation, mediaStream)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('выбрасывает ошибку при updatePresentation если нет текущей презентации', async () => {
    await expect(manager.updatePresentation(beforeStartPresentation, mediaStream)).rejects.toThrow(
      'Presentation has not started yet',
    );
  });

  it('on/once/off работают для событий', () => {
    const handler = jest.fn();

    manager.on('presentation:start', handler);
    // @ts-ignore
    manager.events.trigger('presentation:start', 'data');
    expect(handler).toHaveBeenCalledWith('data');
    manager.off('presentation:start', handler);
    // @ts-ignore
    manager.events.trigger('presentation:start', 'data2');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('promisePendingStartPresentation выставляется и сбрасывается', async () => {
    expect(manager.promisePendingStartPresentation).toBeUndefined();

    const p = manager.startPresentation(beforeStartPresentation, mediaStream);

    expect(manager.promisePendingStartPresentation).toBeInstanceOf(Promise);
    await p;
    expect(manager.promisePendingStartPresentation).toBeUndefined();
  });

  it('promisePendingStopPresentation выставляется и сбрасывается', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    expect(manager.promisePendingStopPresentation).toBeUndefined();

    const p = manager.stopPresentation(beforeStopPresentation);

    expect(manager.promisePendingStopPresentation).toBeInstanceOf(Promise);
    await p;
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('isPendingPresentation корректно отражает состояние', async () => {
    expect(manager.isPendingPresentation).toBe(false);

    const p = manager.startPresentation(beforeStartPresentation, mediaStream);

    expect(manager.isPendingPresentation).toBe(true);
    await p;
    expect(manager.isPendingPresentation).toBe(false);
    await manager.stopPresentation(beforeStopPresentation);
    await manager.startPresentation(beforeStartPresentation, mediaStream);

    const p2 = manager.stopPresentation(beforeStopPresentation);

    expect(manager.isPendingPresentation).toBe(true);
    await p2;
    expect(manager.isPendingPresentation).toBe(false);
  });

  describe('isPresentationInProcess', () => {
    let promise: Promise<MediaStream | undefined>;

    beforeEach(() => {
      promise = Promise.resolve(undefined);
    });

    afterEach(() => {
      promise.catch(() => {});
    });

    it('должен возвращать false, когда нет streamPresentationCurrent и isPendingPresentation false', () => {
      expect(manager.streamPresentationCurrent).toBeUndefined();
      expect(manager.isPendingPresentation).toBe(false);
      expect(manager.isPresentationInProcess).toBe(false);
    });

    it('должен возвращать true во время запуска презентации', () => {
      promise = manager.startPresentation(beforeStartPresentation, mediaStream);

      expect(manager.isPendingPresentation).toBe(true);
      expect(manager.isPresentationInProcess).toBe(true);
    });

    it('должен возвращать true, когда есть streamPresentationCurrent', async () => {
      await manager.startPresentation(beforeStartPresentation, mediaStream);

      expect(manager.streamPresentationCurrent).toBeDefined();
      expect(manager.isPresentationInProcess).toBe(true);
    });

    it('должен возвращать true, когда есть streamPresentationCurrent и isPendingPresentation true', () => {
      promise = manager.startPresentation(beforeStartPresentation, mediaStream);

      expect(manager.streamPresentationCurrent).toBeDefined();
      expect(manager.isPendingPresentation).toBe(true);
      expect(manager.isPresentationInProcess).toBe(true);
    });

    it('должен возвращать true во время остановки презентации', async () => {
      await manager.startPresentation(beforeStartPresentation, mediaStream);

      promise = manager.stopPresentation(beforeStopPresentation);

      expect(manager.isPendingPresentation).toBe(true);
      expect(manager.isPresentationInProcess).toBe(true);
    });

    it('должен возвращать false после полной остановки презентации', async () => {
      await manager.startPresentation(beforeStartPresentation, mediaStream);
      await manager.stopPresentation(beforeStopPresentation);

      expect(manager.streamPresentationCurrent).toBeUndefined();
      expect(manager.isPendingPresentation).toBe(false);
      expect(manager.isPresentationInProcess).toBe(false);
    });
  });

  it('reset сбрасывает все состояния', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    // @ts-ignore
    manager.reset();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
    expect(manager.streamPresentationCurrent).toBeUndefined();
  });

  it('hasCanceledStartPresentationError возвращает true для отменённой презентации', async () => {
    // Запускаем презентацию, отменяем, ловим ошибку
    const promise = manager.startPresentation(beforeStartPresentation, mediaStream);

    manager.cancelSendPresentationWithRepeatedCalls();

    let error: unknown = undefined;

    try {
      await promise;
    } catch (error_) {
      error = error_;
    }

    expect(hasCanceledStartPresentationError(error)).toBe(true);
  });

  it('hasCanceledStartPresentationError возвращает false для обычной ошибки', () => {
    expect(hasCanceledStartPresentationError(new Error('fail'))).toBe(false);
  });

  it('once работает для событий', () => {
    const handler = jest.fn();

    manager.once('presentation:start', handler);
    // @ts-ignore
    manager.events.trigger('presentation:start', 'once-data');
    // @ts-ignore
    manager.events.trigger('presentation:start', 'once-data2');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('once-data');
  });

  it('onceRace работает для событий', () => {
    const handler = jest.fn();

    manager.onceRace(['presentation:start', 'presentation:end'], handler);
    // @ts-ignore
    manager.events.trigger('presentation:end', 'race-data');
    expect(handler).toHaveBeenCalledTimes(1);

    const calls = handler.mock.calls as [string, string][];

    expect(calls[0][0]).toBe('race-data');
    expect(['presentation:start', 'presentation:end']).toContain(calls[0][1]);
  });

  it('wait работает для событий', async () => {
    setTimeout(() => {
      // @ts-ignore
      manager.events.trigger('presentation:start', 'wait-data');
    }, 10);

    const result = await manager.wait('presentation:start');

    expect(result).toBe('wait-data');
  });

  it('handleEnded сбрасывает состояние при событии ended/failed', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    // эмулируем событие ended
    // @ts-ignore
    manager.handleEnded();
    expect(manager.streamPresentationCurrent).toBeUndefined();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('повторные вызовы startPresentation не дублируют презентацию', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    await expect(manager.startPresentation(beforeStartPresentation, mediaStream)).rejects.toThrow(
      'Presentation is already started',
    );
  });

  it('resetPresentation очищает все поля', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    // @ts-ignore
    manager.resetPresentation();
    expect(manager.streamPresentationCurrent).toBeUndefined();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('removeStreamPresentationCurrent очищает streamPresentationCurrent', async () => {
    await manager.startPresentation(beforeStartPresentation, mediaStream);
    // @ts-ignore
    manager.removeStreamPresentationCurrent();
    expect(manager.streamPresentationCurrent).toBeUndefined();
  });

  it('updatePresentation сразу после startPresentation ожидает завершения старта', async () => {
    // Запускаем startPresentation, не дожидаясь завершения, сразу вызываем updatePresentation
    const startPromise = manager.startPresentation(beforeStartPresentation, mediaStream);
    const newStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId2' } },
      video: { deviceId: { exact: 'videoDeviceId2' } },
    });
    // updatePresentation должен дождаться завершения startPresentation
    const updatePromise = manager.updatePresentation(beforeStartPresentation, newStream);
    const [startResult, updateResult] = await Promise.all([startPromise, updatePromise]);

    expect(startResult).toBeDefined();
    expect(updateResult).toBeDefined();
    expect(updateResult?.id).toBe(newStream.id);
  });

  it('startPresentation вызывает FAILED_PRESENTATION и сбрасывает streamPresentationCurrent при ошибке', async () => {
    const targetError = new Error('fail-start');

    RTCSessionMock.setPresentationError(targetError);

    const spy = jest.fn();

    manager.on('presentation:failed', spy);

    let error: TReachedLimitError<Error> | undefined;

    try {
      await manager.startPresentation(beforeStartPresentation, mediaStream);
    } catch (error_) {
      error = error_ as unknown as TReachedLimitError<Error>;
    }

    if (error === undefined) {
      throw new Error('error is undefined');
    }

    const lastResult: Error | undefined = error.values?.lastResult;

    expect(lastResult).toBeInstanceOf(Error);
    expect(lastResult?.message).toBe('fail-start');
    expect(spy).toHaveBeenCalledWith(lastResult);
    expect(manager.streamPresentationCurrent).toBeUndefined();
  });

  it('startPresentation вызывает FAILED_PRESENTATION с new Error(String(error)) когда ошибка не является экземпляром Error', async () => {
    // Устанавливаем ошибку, которая не является экземпляром Error (число)
    const nonErrorValue = 404;

    RTCSessionMock.setPresentationError(nonErrorValue as unknown as Error);

    const spy = jest.fn();

    manager.on('presentation:failed', spy);

    let error: TReachedLimitError<Error> | undefined;

    try {
      await manager.startPresentation(beforeStartPresentation, mediaStream);
    } catch (error_) {
      error = error_ as unknown as TReachedLimitError<Error>;
    }

    if (error === undefined) {
      throw new Error('error is undefined');
    }

    // Проверяем, что событие было вызвано с новым Error, созданным из числа
    expect(spy).toHaveBeenCalled();

    const calledErrors = (spy.mock.calls as [Error][]).map((call) => {
      return call[0] as Error;
    });

    // Проверяем, что хотя бы один вызов был с Error, созданным из числа
    const hasConvertedError = calledErrors.some((error_) => {
      return error_ instanceof Error && error_.message === '404';
    });

    expect(hasConvertedError).toBe(true);
    expect(manager.streamPresentationCurrent).toBeUndefined();
  });

  it('startPresentation выбрасывает ошибку, если directionVideo и directionAudio === recvonly', async () => {
    let error: TReachedLimitError<Error> | undefined;

    try {
      // @ts-expect-error для теста
      await manager.startPresentation(beforeStartPresentation, undefined);
    } catch (error_) {
      error = error_ as unknown as TReachedLimitError<Error>;
    }

    if (error === undefined) {
      throw new Error('error is undefined');
    }

    const lastResult: Error | undefined = error.values?.lastResult;

    expect(lastResult?.message).toBe('No streamPresentationTarget');
    expect(manager.streamPresentationCurrent).toBeUndefined();
  });

  it('stopPresentation без текущей презентации возвращает undefined', async () => {
    const spyFailed = jest.fn();
    const spyEnded = jest.fn();

    manager.on('presentation:failed', spyFailed);
    manager.on('presentation:ended', spyEnded);

    // Вызов без стартовавшей презентации
    const result = await manager.stopPresentation(beforeStopPresentation);

    expect(result).toBeUndefined();
    // Не должно быть текущей презентации
    expect(manager.streamPresentationCurrent).toBeUndefined();
    // Не должно вызываться события failed/ended, так как презентация не запускалась
    expect(spyFailed).not.toHaveBeenCalled();
    expect(spyEnded).not.toHaveBeenCalled();
  });

  it('startPresentation и stopPresentation без ожидания завершения вызывают события в правильном порядке', async () => {
    const eventOrder: string[] = [];

    // Подписываемся на все события презентации для отслеживания порядка
    manager.on('presentation:start', () => {
      eventOrder.push('presentation:start');
    });

    manager.on('presentation:started', () => {
      eventOrder.push('presentation:started');
    });

    manager.on('presentation:end', () => {
      eventOrder.push('presentation:end');
    });

    manager.on('presentation:ended', () => {
      eventOrder.push('presentation:ended');
    });

    manager.on('presentation:failed', () => {
      eventOrder.push('presentation:failed');
    });

    // Запускаем startPresentation, не дожидаясь завершения
    const startPromise = manager.startPresentation(beforeStartPresentation, mediaStream);

    // Сразу вызываем stopPresentation, не дожидаясь завершения startPresentation
    const stopPromise = manager.stopPresentation(beforeStopPresentation);

    // Ждем завершения обеих операций
    const [startResult, stopResult] = await Promise.allSettled([startPromise, stopPromise]);

    // Проверяем, что обе операции завершились успешно
    expect(startResult).toBeDefined();
    expect(stopResult).toBeDefined();
    expect(startResult.status).toBe('rejected');
    expect(stopResult.status).toBe('fulfilled');

    // @ts-expect-error для теста
    expect(hasCanceledStartPresentationError(startResult.reason)).toBe(true);
    // @ts-expect-error для теста
    expect(stopResult.value).toBeDefined();

    // Проверяем правильный порядок событий
    expect(eventOrder).toEqual([
      'presentation:start',
      'presentation:started',
      'presentation:end',
      'presentation:ended',
    ]);

    // Проверяем, что состояние сброшено
    expect(manager.streamPresentationCurrent).toBeUndefined();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('startPresentation и stopPresentation без ожидания завершения вызывают события в правильном порядке при ошибке', async () => {
    const eventOrder: string[] = [];

    // Подписываемся на все события презентации для отслеживания порядка
    manager.on('presentation:start', () => {
      eventOrder.push('presentation:start');
    });

    manager.on('presentation:started', () => {
      eventOrder.push('presentation:started');
    });

    manager.on('presentation:end', () => {
      eventOrder.push('presentation:end');
    });

    manager.on('presentation:ended', () => {
      eventOrder.push('presentation:ended');
    });

    manager.on('presentation:failed', () => {
      eventOrder.push('presentation:failed');
    });

    const testError = new Error('fail');

    // запускаем ошибку
    RTCSessionMock.setPresentationError(testError);

    // Запускаем startPresentation, не дожидаясь завершения
    const startPromise = manager.startPresentation(beforeStartPresentation, mediaStream);
    // Сразу вызываем stopPresentation, не дожидаясь завершения startPresentation
    const stopPromise = manager.stopPresentation(beforeStopPresentation);

    // Ждем завершения обеих операций
    const [startResult, stopResult] = await Promise.allSettled([startPromise, stopPromise]);

    // Проверяем, что обе операции завершились успешно
    expect(startResult).toBeDefined();
    expect(stopResult).toBeDefined();
    expect(startResult.status).toBe('rejected');
    expect(stopResult.status).toBe('rejected');

    // @ts-expect-error для теста
    expect(hasCanceledStartPresentationError(startResult.reason)).toBe(true);
    // @ts-expect-error для теста
    expect(stopResult.reason).toBe(testError);

    // Проверяем правильный порядок событий
    expect(eventOrder).toEqual([
      'presentation:start',
      'presentation:failed',
      'presentation:failed',
      'presentation:end',
      'presentation:failed',
      'presentation:failed',
    ]);

    // Проверяем, что состояние сброшено
    expect(manager.streamPresentationCurrent).toBeUndefined();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });
});
