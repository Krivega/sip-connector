import { createMediaStreamMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCSessionMock from '@/__fixtures__/RTCSessionMock';
import { CallManager } from '@/CallManager';
import { CallSessionState } from '@/CallSessionState';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import PresentationManager, { hasCanceledStartPresentationError } from '../@PresentationManager';
import PresentationSenders from '../PresentationSenders';
import * as presentationSession from '../presentationSession';

import type { TReachedLimitError } from 'repeated-calls';

describe('PresentationManager', () => {
  let callManager: CallManager;
  let rtcSession: RTCSessionMock;
  let connectionMock: RTCPeerConnectionMock;
  let manager: PresentationManager;
  let mediaStream: MediaStream;
  let videoTrack: MediaStreamVideoTrack;
  const beforeStartPresentation = jest.fn(async () => {});
  const beforeStopPresentation = jest.fn(async () => {});

  beforeEach(() => {
    connectionMock = new RTCPeerConnectionMock();
    rtcSession = new RTCSessionMock({
      eventHandlers: {},
      originator: 'local',
    });
    rtcSession.connection = connectionMock;
    callManager = new CallManager(
      { contentedStreamManager: new ContentedStreamManager() },
      {
        sendOffer: jest.fn().mockResolvedValue({} as RTCSessionDescription),
      },
      { callSessionState: new CallSessionState() },
    );
    callManager.getEstablishedRTCSession = jest.fn().mockReturnValue(rtcSession);
    Object.defineProperty(callManager, 'connection', {
      get: () => {
        return connectionMock;
      },
      configurable: true,
    });
    callManager.renegotiate = jest.fn().mockResolvedValue(true);
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
    videoTrack = mediaStream.getVideoTracks()[0] as MediaStreamVideoTrack;

    manager = new PresentationManager({
      callManager: callManager as unknown as CallManager,
    });
  });

  afterEach(() => {
    rtcSession.clear();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('успешно стартует презентацию', async () => {
    const spy = jest.fn();

    manager.on('started', spy);

    const result = await manager.startPresentation(beforeStartPresentation, videoTrack);
    const { videoTrackPresentationCurrent } = manager;

    expect(result).toBeDefined();
    expect(videoTrackPresentationCurrent).toBeDefined();
    expect(result).toBe(videoTrack);

    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStreamVideoTrack]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(videoTrackPresentationCurrent?.id);
  });

  it('не меняет contentHint при contentHint=none', async () => {
    Object.defineProperty(videoTrack, 'contentHint', {
      value: 'motion',
      writable: true,
      configurable: true,
    });

    await manager.startPresentation(beforeStartPresentation, videoTrack, {
      contentHint: 'none',
    });

    expect(videoTrack.contentHint).toBe('motion');
  });

  it('setMaxBitrate пропускает установку, если sender не найден', async () => {
    manager = new PresentationManager({
      callManager: callManager as unknown as CallManager,
      maxBitrate: 1_000_000,
    });

    jest
      .spyOn(presentationSession, 'addOrReplacePresentationVideoTrack')
      .mockResolvedValue(undefined);
    jest.spyOn(connectionMock, 'getSenders').mockReturnValue([]);

    await expect(manager.startPresentation(beforeStartPresentation, videoTrack)).resolves.toBe(
      videoTrack,
    );
  });

  it('выбрасывает ошибку, если нет rtcSession', async () => {
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);
    await expect(manager.startPresentation(beforeStartPresentation, videoTrack)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('выбрасывает ошибку, если презентация уже запущена', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    await expect(manager.startPresentation(beforeStartPresentation, videoTrack)).rejects.toThrow(
      'Presentation is already started',
    );
  });

  it('успешно останавливает презентацию', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);

    const { videoTrackPresentationCurrent } = manager;

    const spy = jest.fn();

    manager.on('ended', spy);

    const result = await manager.stopPresentation(beforeStopPresentation);

    if (!result) {
      throw new Error('result is undefined');
    }

    expect(result.id).toBe(videoTrackPresentationCurrent?.id);
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();

    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStreamVideoTrack]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(videoTrackPresentationCurrent?.id);
  });

  it('корректно сбрасывает состояние после stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    await manager.stopPresentation(beforeStopPresentation);
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
  });

  it('вызывает событие FAILED_PRESENTATION при ошибке stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);

    const testError = new Error('fail');

    beforeStopPresentation.mockRejectedValueOnce(testError);

    const spy = jest.fn();

    manager.on('failed', spy);

    await expect(manager.stopPresentation(beforeStopPresentation)).rejects.toThrow('fail');

    expect(spy).toHaveBeenCalledWith(testError);
  });

  it('вызывает событие FAILED_PRESENTATION в блоке catch при ошибке stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);

    const testError = new Error('fail-catch');

    beforeStopPresentation.mockRejectedValueOnce(testError);

    const spy = jest.fn();

    manager.on('failed', spy);

    await expect(manager.stopPresentation(beforeStopPresentation)).rejects.toThrow('fail-catch');

    expect(spy).toHaveBeenCalledWith(testError);
  });

  it('вызывает событие FAILED_PRESENTATION с new Error(String(error)) когда ошибка не является экземпляром Error в stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);

    const nonErrorValue = 'string-error-message';

    beforeStopPresentation.mockRejectedValueOnce(nonErrorValue);

    const spy = jest.fn();

    manager.on('failed', spy);

    await expect(manager.stopPresentation(beforeStopPresentation)).rejects.toBe(nonErrorValue);

    expect(spy).toHaveBeenCalled();

    const calledErrors = (spy.mock.calls as [Error][]).map((call) => {
      return call[0] as Error;
    });

    const hasConvertedError = calledErrors.some((error) => {
      return error instanceof Error && error.message === 'string-error-message';
    });

    expect(hasConvertedError).toBe(true);
  });

  it('вызывает событие ENDED_PRESENTATION если нет rtcSession при stopPresentation', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);

    const { videoTrackPresentationCurrent } = manager;

    const spy = jest.fn();

    manager.on('ended', spy);
    await manager.stopPresentation(beforeStopPresentation);
    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStreamVideoTrack]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(videoTrackPresentationCurrent?.id);
  });

  it('вызывает событие ENDED_PRESENTATION когда есть streamPresentationPrevious но нет rtcSession', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);

    const { videoTrackPresentationCurrent } = manager;

    // Устанавливаем rtcSession в undefined
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);

    const spy = jest.fn();

    manager.on('ended', spy);

    const result = await manager.stopPresentation(beforeStopPresentation);

    expect(result).toBeUndefined();
    expect(spy).toHaveBeenCalledWith(videoTrackPresentationCurrent);
  });

  it('останавливает презентацию без connection, если rtcSession ещё есть', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);

    Object.defineProperty(callManager, 'connection', {
      get: () => {
        return undefined;
      },
      configurable: true,
    });

    const spyEnded = jest.fn();

    manager.on('ended', spyEnded);

    const result = await manager.stopPresentation(beforeStopPresentation);

    expect(result).toBeDefined();
    expect(spyEnded).toHaveBeenCalled();
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
  });

  it('ожидает отклонение pending startPresentation в stopPresentation', async () => {
    let rejectStart!: (error: Error) => void;

    beforeStartPresentation.mockImplementationOnce(async () => {
      return new Promise<void>((_resolve, reject) => {
        rejectStart = reject;
      });
    });

    const startPromise = manager.startPresentation(beforeStartPresentation, videoTrack);
    const stopPromise = manager.stopPresentation(beforeStopPresentation);

    rejectStart(new Error('start-failed'));

    const [startResult, stopResult] = await Promise.allSettled([startPromise, stopPromise]);

    expect(startResult.status).toBe('rejected');
    expect(stopResult.status).toBe('fulfilled');
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
  });

  it('успешно обновляет презентацию', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);

    const { videoTrackPresentationCurrent } = manager;

    const newStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId2' } },
      video: { deviceId: { exact: 'videoDeviceId2' } },
    });

    const spy = jest.fn();

    manager.on('started', spy);

    const result = await manager.updatePresentation(
      beforeStartPresentation,
      newStream.getVideoTracks()[0] as MediaStreamVideoTrack,
    );

    const { videoTrackPresentationCurrent: videoTrackPresentationCurrent2 } = manager;

    expect(result).toBeDefined();

    if (!result) {
      throw new Error('result is undefined');
    }

    if (!videoTrackPresentationCurrent) {
      throw new Error('videoTrackPresentationCurrent is undefined');
    }

    if (!videoTrackPresentationCurrent2) {
      throw new Error('videoTrackPresentationCurrent2 is undefined');
    }

    expect(videoTrackPresentationCurrent.id).not.toBe(videoTrackPresentationCurrent2.id);

    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStreamVideoTrack]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(videoTrackPresentationCurrent2.id);
  });

  it('выбрасывает ошибку при updatePresentation если нет rtcSession', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);
    await expect(manager.updatePresentation(beforeStartPresentation, videoTrack)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('выбрасывает ошибку при updatePresentation если нет текущей презентации', async () => {
    await expect(manager.updatePresentation(beforeStartPresentation, videoTrack)).rejects.toThrow(
      'Presentation has not started yet',
    );
  });

  it('on/once/off работают для событий', () => {
    const handler = jest.fn();

    manager.on('start', handler);
    // @ts-ignore
    manager.events.trigger('start', 'data');
    expect(handler).toHaveBeenCalledWith('data');
    manager.off('start', handler);
    // @ts-ignore
    manager.events.trigger('start', 'data2');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('promisePendingStartPresentation выставляется и сбрасывается', async () => {
    expect(manager.promisePendingStartPresentation).toBeUndefined();

    const p = manager.startPresentation(beforeStartPresentation, videoTrack);

    expect(manager.promisePendingStartPresentation).toBeInstanceOf(Promise);
    await p;
    expect(manager.promisePendingStartPresentation).toBeUndefined();
  });

  it('promisePendingStopPresentation выставляется и сбрасывается', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    expect(manager.promisePendingStopPresentation).toBeUndefined();

    const p = manager.stopPresentation(beforeStopPresentation);

    expect(manager.promisePendingStopPresentation).toBeInstanceOf(Promise);
    await p;
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('isPendingPresentation корректно отражает состояние', async () => {
    expect(manager.isPendingPresentation).toBe(false);

    const p = manager.startPresentation(beforeStartPresentation, videoTrack);

    expect(manager.isPendingPresentation).toBe(true);
    await p;
    expect(manager.isPendingPresentation).toBe(false);
    await manager.stopPresentation(beforeStopPresentation);
    await manager.startPresentation(beforeStartPresentation, videoTrack);

    const p2 = manager.stopPresentation(beforeStopPresentation);

    expect(manager.isPendingPresentation).toBe(true);
    await p2;
    expect(manager.isPendingPresentation).toBe(false);
  });

  describe('isPresentationInProcess', () => {
    let promise: Promise<MediaStreamVideoTrack | undefined>;

    beforeEach(() => {
      promise = Promise.resolve(undefined);
    });

    afterEach(() => {
      promise.catch(() => {});
    });

    it('должен возвращать false, когда нет videoTrackPresentationCurrent и isPendingPresentation false', () => {
      expect(manager.videoTrackPresentationCurrent).toBeUndefined();
      expect(manager.isPendingPresentation).toBe(false);
      expect(manager.isPresentationInProcess).toBe(false);
    });

    it('должен возвращать true во время запуска презентации', () => {
      promise = manager.startPresentation(beforeStartPresentation, videoTrack);

      expect(manager.isPendingPresentation).toBe(true);
      expect(manager.isPresentationInProcess).toBe(true);
    });

    it('должен возвращать true, когда есть videoTrackPresentationCurrent', async () => {
      await manager.startPresentation(beforeStartPresentation, videoTrack);

      expect(manager.videoTrackPresentationCurrent).toBeDefined();
      expect(manager.isPresentationInProcess).toBe(true);
    });

    it('должен возвращать true, когда есть videoTrackPresentationCurrent и isPendingPresentation true', () => {
      promise = manager.startPresentation(beforeStartPresentation, videoTrack);

      expect(manager.videoTrackPresentationCurrent).toBeDefined();
      expect(manager.isPendingPresentation).toBe(true);
      expect(manager.isPresentationInProcess).toBe(true);
    });

    it('должен возвращать true во время остановки презентации', async () => {
      await manager.startPresentation(beforeStartPresentation, videoTrack);

      promise = manager.stopPresentation(beforeStopPresentation);

      expect(manager.isPendingPresentation).toBe(true);
      expect(manager.isPresentationInProcess).toBe(true);
    });

    it('должен возвращать false после полной остановки презентации', async () => {
      await manager.startPresentation(beforeStartPresentation, videoTrack);
      await manager.stopPresentation(beforeStopPresentation);

      expect(manager.videoTrackPresentationCurrent).toBeUndefined();
      expect(manager.isPendingPresentation).toBe(false);
      expect(manager.isPresentationInProcess).toBe(false);
    });
  });

  it('reset сбрасывает все состояния', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    // @ts-ignore
    manager.reset();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
  });

  it('hasCanceledStartPresentationError возвращает true для отменённой презентации', async () => {
    // Запускаем презентацию, отменяем, ловим ошибку
    const promise = manager.startPresentation(beforeStartPresentation, videoTrack);

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

    manager.once('start', handler);
    // @ts-ignore
    manager.events.trigger('start', 'once-data');
    // @ts-ignore
    manager.events.trigger('start', 'once-data2');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('once-data');
  });

  it('onceRace работает для событий', () => {
    const handler = jest.fn();

    manager.onceRace(['start', 'end'], handler);
    // @ts-ignore
    manager.events.trigger('end', 'race-data');
    expect(handler).toHaveBeenCalledTimes(1);

    const calls = handler.mock.calls as [string, string][];

    expect(calls[0][0]).toBe('race-data');
    expect(['start', 'end']).toContain(calls[0][1]);
  });

  it('wait работает для событий', async () => {
    setTimeout(() => {
      // @ts-ignore
      manager.events.trigger('start', 'wait-data');
    }, 10);

    const result = await manager.wait('start');

    expect(result).toBe('wait-data');
  });

  it('handleEnded сбрасывает состояние при событии ended/failed', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    // эмулируем событие ended
    // @ts-ignore
    manager.handleEnded();
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('повторные вызовы startPresentation не дублируют презентацию', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    await expect(manager.startPresentation(beforeStartPresentation, videoTrack)).rejects.toThrow(
      'Presentation is already started',
    );
  });

  it('resetPresentation очищает все поля', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    // @ts-ignore
    manager.resetPresentation();
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('removeVideoTrackPresentationCurrent очищает videoTrackPresentationCurrent', async () => {
    await manager.startPresentation(beforeStartPresentation, videoTrack);
    // @ts-ignore
    manager.removeVideoTrackPresentationCurrent();
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
  });

  it('updatePresentation сразу после startPresentation ожидает завершения старта', async () => {
    // Запускаем startPresentation, не дожидаясь завершения, сразу вызываем updatePresentation
    const startPromise = manager.startPresentation(beforeStartPresentation, videoTrack);
    const newStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId2' } },
      video: { deviceId: { exact: 'videoDeviceId2' } },
    });
    const newVideoTrack = newStream.getVideoTracks()[0] as MediaStreamVideoTrack;
    // updatePresentation должен дождаться завершения startPresentation
    const updatePromise = manager.updatePresentation(beforeStartPresentation, newVideoTrack);
    const [startResult, updateResult] = await Promise.all([startPromise, updatePromise]);

    expect(startResult).toBeDefined();
    expect(updateResult).toBeDefined();
    expect(updateResult).toBe(newVideoTrack);
  });

  it('startPresentation вызывает FAILED_PRESENTATION и сбрасывает videoTrackPresentationCurrent при ошибке', async () => {
    const targetError = new Error('fail-start');

    jest
      .spyOn(presentationSession, 'addOrReplacePresentationVideoTrack')
      .mockRejectedValueOnce(targetError);

    const spy = jest.fn();

    manager.on('failed', spy);

    let error: TReachedLimitError<Error> | undefined;

    try {
      await manager.startPresentation(beforeStartPresentation, videoTrack);
    } catch (error_) {
      error = error_ as unknown as TReachedLimitError<Error>;
    }

    if (error === undefined) {
      throw new Error('error is undefined');
    }

    const lastResult: Error | undefined = error.values?.lastResult;

    expect(lastResult).toBeInstanceOf(Error);
    expect(lastResult?.message).toBe('Wrong videoTrack');
    expect(spy).toHaveBeenCalledWith(lastResult);
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
  });

  it('startPresentation вызывает FAILED_PRESENTATION с new Error(String(error)) когда ошибка не является экземпляром Error', async () => {
    const nonErrorValue = 404;

    jest
      .spyOn(presentationSession, 'addOrReplacePresentationVideoTrack')
      .mockRejectedValueOnce(nonErrorValue);

    const spy = jest.fn();

    manager.on('failed', spy);

    let error: TReachedLimitError<Error> | undefined;

    try {
      await manager.startPresentation(beforeStartPresentation, videoTrack);
    } catch (error_) {
      error = error_ as unknown as TReachedLimitError<Error>;
    }

    if (error === undefined) {
      throw new Error('error is undefined');
    }

    expect(spy).toHaveBeenCalled();

    const calledErrors = (spy.mock.calls as [Error][]).map((call) => {
      return call[0] as Error;
    });

    const hasConvertedError = calledErrors.some((error_) => {
      return error_ instanceof Error && error_.message === 'Wrong videoTrack';
    });

    expect(hasConvertedError).toBe(true);
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
  });

  it('stopPresentation без текущей презентации возвращает undefined', async () => {
    const spyFailed = jest.fn();
    const spyEnded = jest.fn();

    manager.on('failed', spyFailed);
    manager.on('ended', spyEnded);

    // Вызов без стартовавшей презентации
    const result = await manager.stopPresentation(beforeStopPresentation);

    expect(result).toBeUndefined();
    // Не должно быть текущей презентации
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
    // Не должно вызываться события failed/ended, так как презентация не запускалась
    expect(spyFailed).not.toHaveBeenCalled();
    expect(spyEnded).not.toHaveBeenCalled();
  });

  it('startPresentation и stopPresentation без ожидания завершения вызывают события в правильном порядке', async () => {
    const eventOrder: string[] = [];

    // Подписываемся на все события презентации для отслеживания порядка
    manager.on('start', () => {
      eventOrder.push('start');
    });

    manager.on('started', () => {
      eventOrder.push('started');
    });

    manager.on('end', () => {
      eventOrder.push('end');
    });

    manager.on('ended', () => {
      eventOrder.push('ended');
    });

    manager.on('failed', () => {
      eventOrder.push('failed');
    });

    // Запускаем startPresentation, не дожидаясь завершения
    const startPromise = manager.startPresentation(beforeStartPresentation, videoTrack);

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
    expect(eventOrder).toEqual(['start', 'started', 'end', 'ended']);

    // Проверяем, что состояние сброшено
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('startPresentation и stopPresentation без ожидания завершения вызывают события в правильном порядке при ошибке', async () => {
    const eventOrder: string[] = [];

    // Подписываемся на все события презентации для отслеживания порядка
    manager.on('start', () => {
      eventOrder.push('start');
    });

    manager.on('started', () => {
      eventOrder.push('started');
    });

    manager.on('end', () => {
      eventOrder.push('end');
    });

    manager.on('ended', () => {
      eventOrder.push('ended');
    });

    manager.on('failed', () => {
      eventOrder.push('failed');
    });

    const testError = new Error('fail');

    beforeStopPresentation.mockRejectedValueOnce(testError);

    // Запускаем startPresentation, не дожидаясь завершения
    const startPromise = manager.startPresentation(beforeStartPresentation, videoTrack);
    // Сразу вызываем stopPresentation, не дожидаясь завершения startPresentation
    const stopPromise = manager.stopPresentation(beforeStopPresentation);

    // Ждем завершения обеих операций
    const [startResult, stopResult] = await Promise.allSettled([startPromise, stopPromise]);

    expect(startResult).toBeDefined();
    expect(stopResult).toBeDefined();
    expect(startResult.status).toBe('rejected');
    expect(stopResult.status).toBe('rejected');

    // @ts-expect-error для теста
    expect(hasCanceledStartPresentationError(startResult.reason)).toBe(true);
    // @ts-expect-error для теста
    expect(stopResult.reason).toBe(testError);

    expect(eventOrder).toEqual(['start', 'started', 'failed']);

    // Проверяем, что состояние сброшено
    expect(manager.videoTrackPresentationCurrent).toBeUndefined();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  describe('ограничение sendEncodings по maxResolution', () => {
    const RESOLUTION_4K = { width: 3840, height: 2160 };
    const MAX_RESOLUTION = { width: 1920, height: 1080 };

    let presentationMediaStream: MediaStream;
    let presentationVideoTrack: MediaStreamVideoTrack;

    beforeEach(() => {
      presentationMediaStream = createMediaStreamMock({
        video: {
          deviceId: { exact: 'videoDeviceId' },
          width: { exact: RESOLUTION_4K.width },
          height: { exact: RESOLUTION_4K.height },
        },
      });
      presentationVideoTrack = presentationMediaStream.getVideoTracks()[0] as MediaStreamVideoTrack;
    });

    it('должен ограничивать sendEncodings в startPresentation по maxResolution', async () => {
      const addOrReplacePresentationVideoTrackSpy = jest.spyOn(
        presentationSession,
        'addOrReplacePresentationVideoTrack',
      );

      await manager.startPresentation(beforeStartPresentation, presentationVideoTrack, {
        maxResolution: MAX_RESOLUTION,
      });

      expect(addOrReplacePresentationVideoTrackSpy).toHaveBeenCalledWith(
        connectionMock,
        expect.any(PresentationSenders),
        presentationVideoTrack,
        expect.objectContaining({
          sendEncodings: [{ scaleResolutionDownBy: 2 }],
        }),
      );
    });

    it('должен ограничивать sendEncodings в updatePresentation по maxResolution', async () => {
      await manager.startPresentation(beforeStartPresentation, presentationVideoTrack);

      const addOrReplacePresentationVideoTrackSpy = jest.spyOn(
        presentationSession,
        'addOrReplacePresentationVideoTrack',
      );

      await manager.updatePresentation(beforeStartPresentation, presentationVideoTrack, {
        maxResolution: MAX_RESOLUTION,
      });

      expect(addOrReplacePresentationVideoTrackSpy).toHaveBeenCalledWith(
        connectionMock,
        expect.any(PresentationSenders),
        presentationVideoTrack,
        expect.objectContaining({
          sendEncodings: [{ scaleResolutionDownBy: 2 }],
        }),
      );
    });

    it('не должен изменять sendEncodings, если maxResolution отсутствует', async () => {
      const sendEncodings = [{ maxBitrate: 1_000_000 }];
      const addOrReplacePresentationVideoTrackSpy = jest.spyOn(
        presentationSession,
        'addOrReplacePresentationVideoTrack',
      );

      await manager.startPresentation(beforeStartPresentation, presentationVideoTrack, {
        sendEncodings,
      });

      expect(addOrReplacePresentationVideoTrackSpy).toHaveBeenCalledWith(
        connectionMock,
        expect.any(PresentationSenders),
        presentationVideoTrack,
        expect.objectContaining({
          sendEncodings,
        }),
      );
    });
  });
});
