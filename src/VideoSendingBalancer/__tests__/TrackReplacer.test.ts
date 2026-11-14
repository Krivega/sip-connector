import delayPromise from '@/__fixtures__/delayPromise';
import flushPromises from '@/__fixtures__/flushPromises';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import resolveDebug from '@/logger';
import { createVideoTrack } from '../__fixtures__';
import { TaskQueue } from '../TaskQueue';
import { TrackReplacer } from '../TrackReplacer';

jest.mock('@/logger');

const { mcuDebugLogger } = resolveDebug as jest.Mock & { mcuDebugLogger: jest.Mock };

// eslint-disable-next-line unicorn/no-null
const NO_TRACK = null;

const APPLY_UPCOMING_TRACK_PARAMETERS_LOG = [
  'applyParameters(upcomingTrack):start',
  'applyParameters(upcomingTrack):end',
];
const REPLACE_TRACK_LOG = ['replaceTrack:start', 'replaceTrack:end'];
const APPLY_ACTUAL_TRACK_PARAMETERS_LOG = ['applyParameters():start', 'applyParameters():end'];
const TRACK_REPLACEMENT_LOG = [
  ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
  ...REPLACE_TRACK_LOG,
  'onTrackChange',
];

describe('TrackReplacer', () => {
  let log: string[];
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;
  let sender: RTCRtpSender;
  let originalReplaceTrack: jest.SpyInstance<Promise<void>, [MediaStreamTrack | null]>;
  let originalReplaceTrackGate: Promise<undefined> | undefined;
  let applyParameters: jest.Mock<Promise<void>, [RTCRtpSender, MediaStreamTrack?]>;
  let onTrackChange: jest.Mock<void, [MediaStreamTrack | undefined]>;
  let requestBalance: jest.Mock;
  let taskQueue: TaskQueue;
  let trackReplacer: TrackReplacer;

  const spyOnReplaceTrack = (target: RTCRtpSender) => {
    const replaceTrack = target.replaceTrack.bind(target);

    return jest.spyOn(target, 'replaceTrack').mockImplementation(async (track) => {
      log.push('replaceTrack:start');
      await flushPromises();
      await originalReplaceTrackGate;
      await replaceTrack(track);
      log.push('replaceTrack:end');
    });
  };

  const settleQueue = async () => {
    await delayPromise(0);
  };

  beforeEach(() => {
    log = [];
    originalReplaceTrackGate = undefined;
    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    sender = new RTCRtpSenderMock({ track: track720 });
    originalReplaceTrack = spyOnReplaceTrack(sender);
    applyParameters = jest.fn(async (_sender: RTCRtpSender, upcomingTrack?: MediaStreamTrack) => {
      const step = upcomingTrack ? 'applyParameters(upcomingTrack)' : 'applyParameters()';

      log.push(`${step}:start`);
      await flushPromises();
      log.push(`${step}:end`);
    });
    onTrackChange = jest.fn((_track: MediaStreamTrack | undefined) => {
      log.push('onTrackChange');
    });
    requestBalance = jest.fn();
    taskQueue = new TaskQueue();
    trackReplacer = new TrackReplacer({
      taskQueue,
      applyParameters,
      onTrackChange,
      requestBalance,
    });
  });

  describe('attach', () => {
    it('должен сообщить трек отправителя через onTrackChange', () => {
      trackReplacer.attach(sender);

      expect(onTrackChange).toHaveBeenCalledTimes(1);
      expect(onTrackChange).toHaveBeenCalledWith(track720);
    });

    it('должен сообщить undefined через onTrackChange, если у отправителя нет трека', () => {
      trackReplacer.attach(new RTCRtpSenderMock());

      expect(onTrackChange).toHaveBeenCalledTimes(1);
      expect(onTrackChange).toHaveBeenCalledWith(undefined);
    });

    it('не должен повторно подключаться к уже подключённому отправителю', async () => {
      trackReplacer.attach(sender);
      trackReplacer.attach(sender);
      trackReplacer.detach();
      await sender.replaceTrack(track4K);

      expect(onTrackChange.mock.calls).toEqual([[track720], [undefined]]);
      expect(applyParameters).not.toHaveBeenCalled();
      expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
    });

    it('должен вернуть оригинальный replaceTrack прежнему отправителю и перехватывать замену трека у нового', async () => {
      const otherTrack = createVideoTrack(1920, 1080);
      const otherSender = new RTCRtpSenderMock({ track: otherTrack });

      trackReplacer.attach(sender);
      trackReplacer.attach(otherSender);
      await sender.replaceTrack(track4K);

      expect(applyParameters).not.toHaveBeenCalled();
      expect(onTrackChange.mock.calls).toEqual([[track720], [undefined], [otherTrack]]);

      await otherSender.replaceTrack(track4K);

      expect(applyParameters).toHaveBeenNthCalledWith(1, otherSender, track4K);
      expect(onTrackChange).toHaveBeenLastCalledWith(track4K);
    });
  });

  describe('detach', () => {
    it('должен вернуть отправителю оригинальный replaceTrack и сообщить undefined через onTrackChange', async () => {
      trackReplacer.attach(sender);
      trackReplacer.detach();
      await sender.replaceTrack(track4K);

      expect(originalReplaceTrack).toHaveBeenCalledWith(track4K);
      expect(applyParameters).not.toHaveBeenCalled();
      expect(requestBalance).not.toHaveBeenCalled();
      expect(onTrackChange.mock.calls).toEqual([[track720], [undefined]]);
    });

    it('не должен вызывать onTrackChange, если отправитель не подключён', () => {
      trackReplacer.detach();

      expect(onTrackChange).not.toHaveBeenCalled();
    });

    it('не должен повторно вызывать onTrackChange при повторном отключении', () => {
      trackReplacer.attach(sender);
      trackReplacer.detach();
      trackReplacer.detach();

      expect(onTrackChange.mock.calls).toEqual([[track720], [undefined]]);
    });
  });

  describe('замена трека', () => {
    beforeEach(() => {
      trackReplacer.attach(sender);
      onTrackChange.mockClear();
      log = [];
    });

    describe('успешная замена', () => {
      it('должен применить параметры с учётом нового трека, заменить трек, сообщить новый трек и запросить балансировку', async () => {
        await sender.replaceTrack(track4K);

        expect(log).toEqual(TRACK_REPLACEMENT_LOG);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(originalReplaceTrack).toHaveBeenCalledWith(track4K);
        expect(onTrackChange).toHaveBeenCalledWith(track4K);
        expect(requestBalance).toHaveBeenCalledTimes(1);
        expect(sender.track).toBe(track4K);
      });

      it('должен запросить балансировку только после завершения задачи замены', async () => {
        const originalReplacement = Promise.withResolvers<undefined>();

        originalReplaceTrackGate = originalReplacement.promise;

        const replacing = sender.replaceTrack(track4K);

        await settleQueue();

        expect(requestBalance).not.toHaveBeenCalled();

        originalReplacement.resolve(undefined);
        await replacing;

        expect(requestBalance).toHaveBeenCalledTimes(1);
      });

      it('не должен применять параметры с учётом нового трека при замене на тот же трек', async () => {
        await sender.replaceTrack(track720);

        expect(log).toEqual([...REPLACE_TRACK_LOG, 'onTrackChange']);
        expect(originalReplaceTrack).toHaveBeenCalledWith(track720);
        expect(onTrackChange).toHaveBeenCalledWith(track720);
        expect(requestBalance).toHaveBeenCalledTimes(1);
      });

      it('не должен применять параметры с учётом нового трека при replaceTrack(null)', async () => {
        await sender.replaceTrack(NO_TRACK);

        expect(log).toEqual([...REPLACE_TRACK_LOG, 'onTrackChange']);
        expect(originalReplaceTrack).toHaveBeenCalledWith(NO_TRACK);
        expect(onTrackChange).toHaveBeenCalledWith(undefined);
      });

      it('не должен запрашивать балансировку после замены на пустой трек', async () => {
        await sender.replaceTrack(NO_TRACK);

        expect(requestBalance).not.toHaveBeenCalled();
      });

      it('должен выполнять замены по одной в порядке вызова и сравнивать новый трек с треком отправителя на момент выполнения', async () => {
        await Promise.all([sender.replaceTrack(track4K), sender.replaceTrack(track720)]);

        expect(log).toEqual([...TRACK_REPLACEMENT_LOG, ...TRACK_REPLACEMENT_LOG]);
        expect(applyParameters.mock.calls).toEqual([
          [sender, track4K],
          [sender, track720],
        ]);
        expect(requestBalance).toHaveBeenCalledTimes(2);
        expect(sender.track).toBe(track720);
      });

      it('должен начать замену только после завершения задачи, уже выполняющейся в очереди', async () => {
        const runningTask = Promise.withResolvers<undefined>();

        const running = taskQueue.add(async () => {
          return runningTask.promise;
        });
        const replacing = sender.replaceTrack(track4K);

        await settleQueue();

        expect(log).toEqual([]);

        runningTask.resolve(undefined);
        await Promise.all([running, replacing]);

        expect(log).toEqual(TRACK_REPLACEMENT_LOG);
      });
    });

    describe('ошибки', () => {
      it('должен залогировать ошибку применения параметров нового трека, заменить трек и запросить балансировку', async () => {
        const error = new Error('setParameters failed');

        applyParameters.mockRejectedValueOnce(error);

        await sender.replaceTrack(track4K);

        expect(mcuDebugLogger).toHaveBeenCalledWith(
          'applyParameters before replaceTrack: error',
          error,
        );
        expect(log).toEqual([...REPLACE_TRACK_LOG, 'onTrackChange']);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(onTrackChange).toHaveBeenCalledWith(track4K);
        expect(requestBalance).toHaveBeenCalledTimes(1);
        expect(sender.track).toBe(track4K);
      });

      it('должен отклонить замену ошибкой оригинального replaceTrack, вернуть параметры оставшегося трека и не запрашивать балансировку', async () => {
        const error = new Error('replaceTrack failed');

        originalReplaceTrack.mockRejectedValueOnce(error);

        await expect(sender.replaceTrack(track4K)).rejects.toBe(error);
        expect(log).toEqual([
          ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
          ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
        ]);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
        expect(onTrackChange).not.toHaveBeenCalled();
        expect(requestBalance).not.toHaveBeenCalled();
        expect(sender.track).toBe(track720);
      });

      it('должен отклонить замену ошибкой оригинального replaceTrack и вернуть параметры оставшегося трека, если перед этим не удалось применить параметры нового трека', async () => {
        const preparationError = new Error('setParameters failed');
        const replaceTrackError = new Error('replaceTrack failed');

        applyParameters.mockRejectedValueOnce(preparationError);
        originalReplaceTrack.mockRejectedValueOnce(replaceTrackError);

        await expect(sender.replaceTrack(track4K)).rejects.toBe(replaceTrackError);
        expect(mcuDebugLogger).toHaveBeenCalledWith(
          'applyParameters before replaceTrack: error',
          preparationError,
        );
        expect(log).toEqual(APPLY_ACTUAL_TRACK_PARAMETERS_LOG);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
        expect(onTrackChange).not.toHaveBeenCalled();
        expect(requestBalance).not.toHaveBeenCalled();
        expect(sender.track).toBe(track720);
      });

      it('должен отклонить замену ошибкой оригинального replaceTrack и залогировать ошибку возврата параметров оставшегося трека', async () => {
        const replaceTrackError = new Error('replaceTrack failed');
        const restoreError = new Error('restore failed');

        originalReplaceTrack.mockRejectedValueOnce(replaceTrackError);
        applyParameters.mockResolvedValueOnce(undefined).mockRejectedValueOnce(restoreError);

        await expect(sender.replaceTrack(track4K)).rejects.toBe(replaceTrackError);
        expect(mcuDebugLogger).toHaveBeenCalledWith(
          'applyParameters after replaceTrack: error',
          restoreError,
        );
      });
    });

    describe('отключение во время оригинального replaceTrack', () => {
      let originalReplacement: PromiseWithResolvers<undefined>;
      let replacing: Promise<void>;

      beforeEach(async () => {
        originalReplacement = Promise.withResolvers<undefined>();
        originalReplaceTrackGate = originalReplacement.promise;
        replacing = sender.replaceTrack(track4K);
        await settleQueue();
      });

      it('должен запросить балансировку, но не сообщать трек через onTrackChange, если отправитель отключён', async () => {
        trackReplacer.detach();
        originalReplacement.resolve(undefined);
        await replacing;

        expect(requestBalance).toHaveBeenCalledTimes(1);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(onTrackChange.mock.calls).toEqual([[undefined]]);
        expect(sender.track).toBe(track4K);
      });

      it('должен сообщить новый трек через onTrackChange, если отправитель подключён снова', async () => {
        trackReplacer.detach();
        trackReplacer.attach(sender);
        originalReplacement.resolve(undefined);
        await replacing;

        expect(onTrackChange.mock.calls).toEqual([[undefined], [track720], [track4K]]);
      });
    });
  });
});
