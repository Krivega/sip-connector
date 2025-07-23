import { createMediaStreamMock } from 'webrtc-mock';
import RTCSessionMock from '../../__fixtures__/RTCSessionMock';
import { CallManager } from '../../CallManager';
import PresentationManager from '../@PresentationManager';
import { EEvent } from '../eventNames';

describe('PresentationManager', () => {
  let callManager: CallManager;
  let rtcSession: RTCSessionMock;
  let manager: PresentationManager;
  let mediaStream: MediaStream;

  beforeEach(() => {
    rtcSession = new RTCSessionMock({
      url: 'wss://test.com',
      eventHandlers: {},
      originator: 'local',
    });
    callManager = new CallManager();
    rtcSession.on('presentation:start', (data) => {
      callManager.events.trigger('presentation:start', data);
    });
    rtcSession.on('presentation:started', (data) => {
      callManager.events.trigger('presentation:started', data);
    });
    rtcSession.on('presentation:end', (data) => {
      callManager.events.trigger('presentation:end', data);
    });
    rtcSession.on('presentation:ended', (data) => {
      callManager.events.trigger('presentation:ended', data);
    });
    rtcSession.on('presentation:failed', (data) => {
      callManager.events.trigger('presentation:failed', data);
    });
    callManager.getEstablishedRTCSession = jest.fn().mockReturnValue(rtcSession);
    mediaStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId' } },
      video: { deviceId: { exact: 'videoDeviceId' } },
    });
    manager = new PresentationManager({ callManager: callManager as unknown as CallManager });
  });

  afterEach(() => {
    RTCSessionMock.resetPresentationError();
  });

  it('успешно стартует презентацию', async () => {
    const spy = jest.fn();

    manager.on('presentation:started', spy);

    const result = await manager.startPresentation(mediaStream);
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
    await expect(manager.startPresentation(mediaStream)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('выбрасывает ошибку, если презентация уже запущена', async () => {
    await manager.startPresentation(mediaStream);
    await expect(manager.startPresentation(mediaStream)).rejects.toThrow(
      'Presentation is already started',
    );
  });

  it('успешно останавливает презентацию', async () => {
    await manager.startPresentation(mediaStream);

    const { streamPresentationCurrent } = manager;

    const spy = jest.fn();

    manager.on('presentation:ended', spy);

    const result = await manager.stopPresentation();

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
    await manager.startPresentation(mediaStream);
    await manager.stopPresentation();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
    expect(manager.streamPresentationCurrent).toBeUndefined();
  });

  it('вызывает событие FAILED_PRESENTATION при ошибке stopPresentation', async () => {
    await manager.startPresentation(mediaStream);
    RTCSessionMock.setPresentationError(new Error('fail'));

    const spy = jest.fn();

    manager.on(EEvent.FAILED_PRESENTATION, spy);
    await expect(manager.stopPresentation()).rejects.toThrow('fail');
    expect(spy).toHaveBeenCalledWith(expect.any(Error));
  });

  it('вызывает событие ENDED_PRESENTATION если нет rtcSession при stopPresentation', async () => {
    await manager.startPresentation(mediaStream);
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);

    const { streamPresentationCurrent } = manager;

    const spy = jest.fn();

    manager.on(EEvent.ENDED_PRESENTATION, spy);
    await manager.stopPresentation();
    expect(spy).toHaveBeenCalled();

    const mock = spy as jest.Mock;

    expect(mock.mock.calls.length).toBeGreaterThan(0);

    const [[calledWith]] = mock.mock.calls as [[MediaStream]];

    expect(calledWith).toBeDefined();
    expect(calledWith.id).toBe(streamPresentationCurrent?.id);
  });

  it('успешно обновляет презентацию', async () => {
    await manager.startPresentation(mediaStream);

    const { streamPresentationCurrent } = manager;

    const newStream = createMediaStreamMock({
      audio: { deviceId: { exact: 'audioDeviceId2' } },
      video: { deviceId: { exact: 'videoDeviceId2' } },
    });

    const spy = jest.fn();

    manager.on('presentation:started', spy);

    const result = await manager.updatePresentation(newStream);

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
    await manager.startPresentation(mediaStream);
    (
      callManager as unknown as { getEstablishedRTCSession: jest.Mock }
    ).getEstablishedRTCSession.mockReturnValue(undefined);
    await expect(manager.updatePresentation(mediaStream)).rejects.toThrow(
      'No rtcSession established',
    );
  });

  it('выбрасывает ошибку при updatePresentation если нет текущей презентации', async () => {
    await expect(manager.updatePresentation(mediaStream)).rejects.toThrow(
      'Presentation has not started yet',
    );
  });

  it('on/once/off работают для событий', () => {
    const handler = jest.fn();

    manager.on(EEvent.START_PRESENTATION, handler);
    // @ts-ignore
    manager.events.trigger(EEvent.START_PRESENTATION, 'data');
    expect(handler).toHaveBeenCalledWith('data');
    manager.off(EEvent.START_PRESENTATION, handler);
    // @ts-ignore
    manager.events.trigger(EEvent.START_PRESENTATION, 'data2');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('promisePendingStartPresentation выставляется и сбрасывается', async () => {
    expect(manager.promisePendingStartPresentation).toBeUndefined();

    const p = manager.startPresentation(mediaStream);

    expect(manager.promisePendingStartPresentation).toBeInstanceOf(Promise);
    await p;
    expect(manager.promisePendingStartPresentation).toBeUndefined();
  });

  it('promisePendingStopPresentation выставляется и сбрасывается', async () => {
    await manager.startPresentation(mediaStream);
    expect(manager.promisePendingStopPresentation).toBeUndefined();

    const p = manager.stopPresentation();

    expect(manager.promisePendingStopPresentation).toBeInstanceOf(Promise);
    await p;
    expect(manager.promisePendingStopPresentation).toBeUndefined();
  });

  it('isPendingPresentation корректно отражает состояние', async () => {
    expect(manager.isPendingPresentation).toBe(false);

    const p = manager.startPresentation(mediaStream);

    expect(manager.isPendingPresentation).toBe(true);
    await p;
    expect(manager.isPendingPresentation).toBe(false);
    await manager.stopPresentation();
    await manager.startPresentation(mediaStream);

    const p2 = manager.stopPresentation();

    expect(manager.isPendingPresentation).toBe(true);
    await p2;
    expect(manager.isPendingPresentation).toBe(false);
  });

  it('reset сбрасывает все состояния', async () => {
    await manager.startPresentation(mediaStream);
    // @ts-ignore
    manager.reset();
    expect(manager.promisePendingStartPresentation).toBeUndefined();
    expect(manager.promisePendingStopPresentation).toBeUndefined();
    expect(manager.streamPresentationCurrent).toBeUndefined();
  });
});
