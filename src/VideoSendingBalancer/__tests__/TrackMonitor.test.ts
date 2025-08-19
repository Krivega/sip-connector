import { createVideoMediaStreamTrackMock } from 'webrtc-mock';

import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { TrackMonitor } from '../TrackMonitor';

// Helper to create mock MediaStreamTrack based on webrtc-mock implementation
const createMockTrack = (initialWidth: number) => {
  let width = initialWidth;

  // webrtc-mock возвращает полноценный объект с необходимыми методами
  const track = createVideoMediaStreamTrackMock({
    constraints: { width, height: 480 },
  });

  // Переопределяем getSettings, чтобы он отражал динамический width
  Object.defineProperty(track, 'getSettings', {
    value: jest.fn(() => {
      return { width, height: 480 };
    }),
  });

  const setWidth = (newWidth: number) => {
    width = newWidth;
  };

  return { track, setWidth };
};

describe('TrackMonitor', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('calls callback on size change via polling', () => {
    const { track, setWidth } = createMockTrack(640); // no resize event support

    const sender = new RTCRtpSenderMock({ track });
    const connection = new RTCPeerConnectionMock(undefined, [track]);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [sender];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(sender, callback);
    expect(callback).not.toHaveBeenCalled();

    setWidth(320);
    jest.advanceTimersByTime(500);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('calls callback after replaceTrack and monitors new track', async () => {
    const original = createMockTrack(640);
    const newTrackMock = createMockTrack(800);

    const sender = new RTCRtpSenderMock({ track: original.track });

    jest.spyOn(sender, 'replaceTrack');

    const connection = new RTCPeerConnectionMock(undefined, [original.track]);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [sender];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(sender, callback);

    // Replace track (the monitor patched replaceTrack internally)
    await (sender as RTCRtpSender).replaceTrack(newTrackMock.track);

    // Callback should be called once for replaceTrack
    expect(callback).toHaveBeenCalledTimes(1);

    // Теперь меняем размеры нового трека и прокручиваем таймеры — колбэк должен сработать второй раз
    newTrackMock.setWidth(640);
    jest.advanceTimersByTime(1000);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  test('calls callback on size change via polling (Safari fallback)', () => {
    const { track, setWidth } = createMockTrack(640); // no resize event support

    const sender = new RTCRtpSenderMock({ track });
    const connection = new RTCPeerConnectionMock(undefined, [track]);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [sender];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(sender, callback);
    expect(callback).not.toHaveBeenCalled();

    setWidth(320);
    jest.advanceTimersByTime(500);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test('does nothing when connection is undefined', () => {
    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    expect(() => {
      monitor.subscribe(undefined, callback);
    }).not.toThrow();

    expect(callback).not.toHaveBeenCalled();
  });

  test('does nothing when getSenders returns no video sender', () => {
    const connection = new RTCPeerConnectionMock(undefined, []);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(undefined, callback);

    expect(callback).not.toHaveBeenCalled();
  });

  test('handles replaceTrack(null) and does not start polling for undefined track', async () => {
    const original = createMockTrack(640);

    const sender = new RTCRtpSenderMock({ track: original.track });

    jest.spyOn(sender, 'replaceTrack');

    const connection = new RTCPeerConnectionMock(undefined, [original.track]);

    Object.defineProperty(connection, 'getSenders', {
      value: () => {
        return [sender];
      },
    });

    const callback = jest.fn();
    const monitor = new TrackMonitor({ pollIntervalMs: 500 });

    monitor.subscribe(sender, callback);

    // eslint-disable-next-line unicorn/no-null
    await sender.replaceTrack(null);

    // callback должен вызваться (handleTrackResize), но polling не запускается
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
