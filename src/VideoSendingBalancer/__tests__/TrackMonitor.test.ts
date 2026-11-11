import { createMockTrack, createVideoTrack } from '../__fixtures__';
import { TrackMonitor } from '../TrackMonitor';

const POLL_INTERVAL_MS = 100;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_MAX_POLL_INTERVAL_MS = 16 * POLL_INTERVAL_MS;

// дольше максимального интервала опроса по умолчанию
const POLLING_WINDOW_MS = 2 * DEFAULT_MAX_POLL_INTERVAL_MS;

describe('TrackMonitor', () => {
  let monitor: TrackMonitor;
  let callback: jest.Mock;
  let track: MediaStreamTrack;
  let setWidth: (width: number) => void;

  beforeEach(() => {
    jest.useFakeTimers();

    monitor = new TrackMonitor({ pollIntervalMs: POLL_INTERVAL_MS });
    callback = jest.fn();
    ({ track, setWidth } = createMockTrack(640));
  });

  afterEach(() => {
    monitor.unsubscribe();
    jest.useRealTimers();
  });

  describe('изменение размера трека', () => {
    it('должен вызвать callback при изменении ширины трека', () => {
      monitor.subscribe(track, callback);
      setWidth(320);
      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('должен вызвать callback при изменении высоты трека', () => {
      const track720 = createVideoTrack(1280, 720);

      monitor.subscribe(track720, callback);
      jest.spyOn(track720, 'getSettings').mockReturnValue({ width: 1280, height: 360 });
      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('не должен вызывать callback, пока размер трека не меняется', () => {
      monitor.subscribe(track, callback);
      jest.advanceTimersByTime(POLLING_WINDOW_MS);

      expect(callback).not.toHaveBeenCalled();
    });

    it('не должен повторно вызывать callback, если размер трека больше не менялся', () => {
      monitor.subscribe(track, callback);
      setWidth(320);
      jest.advanceTimersByTime(POLLING_WINDOW_MS);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('интервал опроса', () => {
    it('должен опрашивать трек раз в секунду по умолчанию', () => {
      monitor = new TrackMonitor({});
      monitor.subscribe(track, callback);
      setWidth(320);
      jest.advanceTimersByTime(DEFAULT_POLL_INTERVAL_MS - 1);

      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('должен удваивать интервал опроса, пока размер трека не меняется', () => {
      monitor.subscribe(track, callback);
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      setWidth(320);
      jest.advanceTimersByTime(2 * POLL_INTERVAL_MS - 1);

      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('должен вернуть начальный интервал опроса после изменения размера трека', () => {
      monitor.subscribe(track, callback);
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      setWidth(320);
      jest.advanceTimersByTime(2 * POLL_INTERVAL_MS);
      setWidth(640);
      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('не должен увеличивать интервал опроса больше maxPollIntervalMs', () => {
      const maxPollIntervalMs = 3 * POLL_INTERVAL_MS;

      monitor = new TrackMonitor({ pollIntervalMs: POLL_INTERVAL_MS, maxPollIntervalMs });
      monitor.subscribe(track, callback);
      jest.advanceTimersByTime(POLL_INTERVAL_MS + 2 * POLL_INTERVAL_MS + maxPollIntervalMs);
      setWidth(320);
      jest.advanceTimersByTime(maxPollIntervalMs - 1);

      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('не должен увеличивать интервал опроса больше 16 начальных интервалов по умолчанию', () => {
      monitor.subscribe(track, callback);
      jest.advanceTimersByTime((1 + 2 + 4 + 8 + 16) * POLL_INTERVAL_MS);
      setWidth(320);
      jest.advanceTimersByTime(DEFAULT_MAX_POLL_INTERVAL_MS - 1);

      expect(callback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('должен прекратить опрос трека', () => {
      monitor.subscribe(track, callback);
      monitor.unsubscribe();
      setWidth(320);
      jest.advanceTimersByTime(POLLING_WINDOW_MS);

      expect(callback).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('должен прекратить опрос трека, если вызван из callback', () => {
      callback.mockImplementation(() => {
        monitor.unsubscribe();
      });
      monitor.subscribe(track, callback);
      setWidth(320);
      jest.advanceTimersByTime(POLLING_WINDOW_MS);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('повторная подписка', () => {
    let nextTrack: MediaStreamTrack;
    let setNextWidth: (width: number) => void;
    let nextCallback: jest.Mock;

    beforeEach(() => {
      ({ track: nextTrack, setWidth: setNextWidth } = createMockTrack(1280));
      nextCallback = jest.fn();
    });

    it('должен следить только за новым треком', () => {
      monitor.subscribe(track, callback);
      monitor.subscribe(nextTrack, nextCallback);
      setWidth(320);
      jest.advanceTimersByTime(POLLING_WINDOW_MS);

      expect(callback).not.toHaveBeenCalled();
      expect(nextCallback).not.toHaveBeenCalled();

      setNextWidth(640);
      jest.advanceTimersByTime(POLLING_WINDOW_MS);

      expect(callback).not.toHaveBeenCalled();
      expect(nextCallback).toHaveBeenCalledTimes(1);
    });

    it('должен опрашивать новый трек с начального интервала', () => {
      monitor.subscribe(track, callback);
      jest.advanceTimersByTime(POLL_INTERVAL_MS + 2 * POLL_INTERVAL_MS);
      monitor.subscribe(nextTrack, nextCallback);
      setNextWidth(640);
      jest.advanceTimersByTime(POLL_INTERVAL_MS);

      expect(nextCallback).toHaveBeenCalledTimes(1);
    });

    it('должен следить только за новым треком, если подписка на него вызвана из callback', () => {
      callback.mockImplementation(() => {
        monitor.subscribe(nextTrack, nextCallback);
      });
      monitor.subscribe(track, callback);
      setWidth(320);
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
      setNextWidth(640);
      jest.advanceTimersByTime(POLLING_WINDOW_MS);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(nextCallback).toHaveBeenCalledTimes(1);
    });
  });
});
