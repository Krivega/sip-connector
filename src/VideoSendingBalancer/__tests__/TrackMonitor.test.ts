import { TrackMonitor } from '../TrackMonitor';

const POLL_INTERVAL_MS = 100;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_MAX_POLL_INTERVAL_MS = 16 * POLL_INTERVAL_MS;

// дольше максимального интервала опроса по умолчанию
const POLLING_WINDOW_MS = 2 * DEFAULT_MAX_POLL_INTERVAL_MS;

describe('TrackMonitor', () => {
  let monitor: TrackMonitor;
  let check: jest.Mock<Promise<boolean>, []>;

  beforeEach(() => {
    jest.useFakeTimers();

    monitor = new TrackMonitor({ pollIntervalMs: POLL_INTERVAL_MS });
    check = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
  });

  afterEach(() => {
    monitor.unsubscribe();
    jest.useRealTimers();
  });

  describe('интервал опроса', () => {
    it('должен вызвать проверку по истечении начального интервала', async () => {
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1);

      expect(check).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(check).toHaveBeenCalledTimes(1);
    });

    it('должен вызывать проверку раз в секунду по умолчанию', async () => {
      monitor = new TrackMonitor({});
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(DEFAULT_POLL_INTERVAL_MS - 1);

      expect(check).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(check).toHaveBeenCalledTimes(1);
    });

    it('должен удваивать интервал опроса, пока проверка не сообщает об изменениях', async () => {
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 2 * POLL_INTERVAL_MS - 1);

      expect(check).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);

      expect(check).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(4 * POLL_INTERVAL_MS - 1);

      expect(check).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(1);

      expect(check).toHaveBeenCalledTimes(3);
    });

    it('должен вернуть начальный интервал опроса после того, как проверка сообщила об изменениях', async () => {
      check.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 2 * POLL_INTERVAL_MS);

      expect(check).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(check).toHaveBeenCalledTimes(3);
    });

    it('должен удвоить интервал опроса после ошибки проверки', async () => {
      check.mockRejectedValueOnce(new Error('check failed'));
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 2 * POLL_INTERVAL_MS - 1);

      expect(check).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);

      expect(check).toHaveBeenCalledTimes(2);
    });

    it('не должен увеличивать интервал опроса больше maxPollIntervalMs', async () => {
      const maxPollIntervalMs = 3 * POLL_INTERVAL_MS;

      monitor = new TrackMonitor({ pollIntervalMs: POLL_INTERVAL_MS, maxPollIntervalMs });
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(
        POLL_INTERVAL_MS + 2 * POLL_INTERVAL_MS + maxPollIntervalMs,
      );
      check.mockClear();
      await jest.advanceTimersByTimeAsync(maxPollIntervalMs - 1);

      expect(check).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(check).toHaveBeenCalledTimes(1);
    });

    it('не должен увеличивать интервал опроса больше 16 начальных интервалов по умолчанию', async () => {
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync((1 + 2 + 4 + 8 + 16) * POLL_INTERVAL_MS);
      check.mockClear();
      await jest.advanceTimersByTimeAsync(DEFAULT_MAX_POLL_INTERVAL_MS - 1);

      expect(check).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);

      expect(check).toHaveBeenCalledTimes(1);
    });

    it('должен запланировать следующий опрос только после завершения проверки', async () => {
      const checking = Promise.withResolvers<boolean>();

      check.mockReturnValueOnce(checking.promise);
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(check).toHaveBeenCalledTimes(1);

      checking.resolve(true);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(check).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribe', () => {
    it('должен прекратить опрос', async () => {
      monitor.subscribe(check);
      monitor.unsubscribe();
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(check).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('должен прекратить опрос, если вызван, пока идёт проверка', async () => {
      const checking = Promise.withResolvers<boolean>();

      check.mockReturnValueOnce(checking.promise);
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      monitor.unsubscribe();
      checking.resolve(true);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(check).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('повторная подписка', () => {
    let nextCheck: jest.Mock<Promise<boolean>, []>;

    beforeEach(() => {
      nextCheck = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
    });

    it('должен вызывать только новую проверку', async () => {
      monitor.subscribe(check);
      monitor.subscribe(nextCheck);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(check).not.toHaveBeenCalled();
      expect(nextCheck).toHaveBeenCalled();
    });

    it('должен вызвать новую проверку через начальный интервал', async () => {
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 2 * POLL_INTERVAL_MS);
      monitor.subscribe(nextCheck);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(nextCheck).toHaveBeenCalledTimes(1);
    });

    it('не должен продолжать опрос прежней проверки, завершившейся после повторной подписки', async () => {
      const checking = Promise.withResolvers<boolean>();

      check.mockReturnValueOnce(checking.promise);
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      monitor.subscribe(nextCheck);
      checking.resolve(true);
      await jest.advanceTimersByTimeAsync(POLLING_WINDOW_MS);

      expect(check).toHaveBeenCalledTimes(1);
      expect(jest.getTimerCount()).toBe(1);
    });
  });

  describe('resetInterval', () => {
    it('должен вернуть опрос к начальному интервалу', async () => {
      monitor.subscribe(check);
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 2 * POLL_INTERVAL_MS);
      check.mockClear();
      monitor.resetInterval();
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(check).toHaveBeenCalledTimes(1);
    });

    it('не должен начинать опрос без подписки', () => {
      monitor.resetInterval();

      expect(jest.getTimerCount()).toBe(0);
    });
  });
});
