import delayPromise from '@/__fixtures__/delayPromise';
import flushPromises from '@/__fixtures__/flushPromises';
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import resolveDebug from '@/logger';
import { createVideoTrack } from '../__fixtures__';
import { TaskQueue } from '../TaskQueue';
import { TrackReplacer } from '../TrackReplacer';

jest.mock('@/logger');

const { mcuDebugLogger } = resolveDebug as jest.Mock & { mcuDebugLogger: jest.Mock };

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
  ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
];

describe('TrackReplacer', () => {
  let log: string[];
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;
  let sender: RTCRtpSender;
  let originalReplaceTrack: jest.SpyInstance<Promise<void>, [MediaStreamTrack | null]>;
  let originalReplaceTrackGate: Promise<undefined> | undefined;
  let applyParameters: jest.Mock<
    Promise<{ isChanged: boolean }>,
    [RTCRtpSender, MediaStreamTrack?]
  >;
  let requestBalance: jest.Mock;
  let isStarted: boolean;
  let isExcluded: boolean;
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

  const applyLoggedParameters = async (_sender: RTCRtpSender, upcomingTrack?: MediaStreamTrack) => {
    const step = upcomingTrack ? 'applyParameters(upcomingTrack)' : 'applyParameters()';

    log.push(`${step}:start`);
    await flushPromises();
    log.push(`${step}:end`);

    return { isChanged: false };
  };

  const settleQueue = async () => {
    await delayPromise(0);
  };

  // замена через перехват после этого завершится не раньше таймаута ожидания записи, вызов оригинального replaceTrack — завершится
  const hangSenderQueue = () => {
    taskQueue
      .add(sender, async () => {
        return new Promise<undefined>(() => {});
      })
      .catch(() => {});
  };

  beforeEach(() => {
    log = [];
    originalReplaceTrackGate = undefined;
    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    sender = new RTCRtpSenderMock({ track: track720 });
    originalReplaceTrack = spyOnReplaceTrack(sender);
    applyParameters = jest.fn(applyLoggedParameters);
    requestBalance = jest.fn();
    isStarted = true;
    isExcluded = false;
    taskQueue = new TaskQueue();
    trackReplacer = new TrackReplacer({
      taskQueue,
      isBalancing: (target) => {
        return isStarted && trackReplacer.attachedSender === target;
      },
      isExcludedSender: () => {
        return isExcluded;
      },
      applyParameters,
      requestBalance,
    });
  });

  describe('attach', () => {
    it('должен отдавать подключённого отправителя', () => {
      trackReplacer.attach(sender);

      expect(trackReplacer.attachedSender).toBe(sender);
    });

    it('не должен повторно подключаться к уже подключённому отправителю', async () => {
      trackReplacer.attach(sender);

      const interceptedReplaceTrack = sender.replaceTrack;

      trackReplacer.attach(sender);

      expect(sender.replaceTrack).toBe(interceptedReplaceTrack);

      trackReplacer.detach();
      await sender.replaceTrack(track4K);

      expect(applyParameters).not.toHaveBeenCalled();
      expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
    });

    it('должен вернуть оригинальный replaceTrack прежнему отправителю и перехватывать замену трека у нового', async () => {
      const otherSender = new RTCRtpSenderMock({ track: createVideoTrack(1920, 1080) });

      trackReplacer.attach(sender);
      trackReplacer.attach(otherSender);
      await sender.replaceTrack(track4K);

      expect(trackReplacer.attachedSender).toBe(otherSender);
      expect(applyParameters).not.toHaveBeenCalled();

      await otherSender.replaceTrack(track4K);

      expect(applyParameters).toHaveBeenNthCalledWith(1, otherSender, track4K);
    });
  });

  describe('detach', () => {
    it('должен вернуть отправителю оригинальный replaceTrack', async () => {
      trackReplacer.attach(sender);
      trackReplacer.detach();
      hangSenderQueue();

      const replacing = sender.replaceTrack(track4K);

      await settleQueue();

      // через перехват замена завершилась бы не раньше таймаута ожидания записи
      expect(sender.track).toBe(track4K);

      await replacing;

      expect(trackReplacer.attachedSender).toBeUndefined();
      expect(originalReplaceTrack).toHaveBeenCalledWith(track4K);
      expect(applyParameters).not.toHaveBeenCalled();
      expect(requestBalance).not.toHaveBeenCalled();
    });

    it('не должен ничего делать, если отправитель не подключён', () => {
      expect(() => {
        trackReplacer.detach();
      }).not.toThrow();
    });
  });

  describe('замена трека', () => {
    beforeEach(() => {
      trackReplacer.attach(sender);
      log = [];
    });

    describe('успешная замена', () => {
      it('должен применить параметры с учётом нового трека, заменить трек, применить параметры нового трека и запросить балансировку', async () => {
        await sender.replaceTrack(track4K);

        expect(log).toEqual(TRACK_REPLACEMENT_LOG);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
        expect(originalReplaceTrack).toHaveBeenCalledWith(track4K);
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

        expect(log).toEqual([...REPLACE_TRACK_LOG, ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG]);
        expect(originalReplaceTrack).toHaveBeenCalledWith(track720);
        expect(requestBalance).toHaveBeenCalledTimes(1);
      });

      it('не должен применять параметры с учётом нового трека при replaceTrack(null)', async () => {
        await sender.replaceTrack(NO_TRACK);

        expect(log).toEqual([...REPLACE_TRACK_LOG, ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG]);
        expect(originalReplaceTrack).toHaveBeenCalledWith(NO_TRACK);
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
          [sender],
          [sender, track720],
          [sender],
        ]);
        expect(requestBalance).toHaveBeenCalledTimes(2);
        expect(sender.track).toBe(track720);
      });

      it('должен начать замену только после завершения задачи, уже выполняющейся в очереди отправителя', async () => {
        const runningTask = Promise.withResolvers<undefined>();

        const running = taskQueue.add(sender, async () => {
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

    describe('цепочка подготовки', () => {
      it('должен вызвать оригинальный replaceTrack только после звена, добавленного во время применения параметров с учётом нового трека', async () => {
        applyParameters.mockImplementationOnce(async (...args) => {
          trackReplacer.prepareOngoingReplacement();

          return applyLoggedParameters(...args);
        });

        await sender.replaceTrack(track4K);

        expect(log).toEqual([
          ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
          ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
          ...REPLACE_TRACK_LOG,
          ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
        ]);
      });

      it('должен применить параметры с учётом нового трека во время оригинального replaceTrack, если звено добавлено в это время, и применить параметры после замены только после него', async () => {
        const originalReplacement = Promise.withResolvers<undefined>();
        const addedStep = Promise.withResolvers<undefined>();

        originalReplaceTrackGate = originalReplacement.promise;

        const replacing = sender.replaceTrack(track4K);

        await settleQueue();
        applyParameters.mockImplementationOnce(async () => {
          await addedStep.promise;

          return { isChanged: true };
        });
        trackReplacer.prepareOngoingReplacement();
        originalReplacement.resolve(undefined);
        await settleQueue();

        expect(sender.track).toBe(track4K);
        expect(applyParameters.mock.calls).toEqual([
          [sender, track4K],
          [sender, track4K],
        ]);

        addedStep.resolve(undefined);
        await replacing;

        expect(applyParameters.mock.calls).toEqual([
          [sender, track4K],
          [sender, track4K],
          [sender],
        ]);
      });

      it('должен вернуть параметры оставшегося трека только после звена, добавленного во время оригинального replaceTrack, если оригинал отклонён', async () => {
        const error = new Error('replaceTrack failed');
        const originalReplacement = Promise.withResolvers<undefined>();
        const addedStep = Promise.withResolvers<undefined>();

        originalReplaceTrackGate = originalReplacement.promise;

        const replacing = Promise.allSettled([sender.replaceTrack(track4K)]);

        await settleQueue();
        applyParameters.mockImplementationOnce(async () => {
          await addedStep.promise;

          return { isChanged: true };
        });
        trackReplacer.prepareOngoingReplacement();
        originalReplacement.reject(error);
        await settleQueue();

        expect(applyParameters.mock.calls).toEqual([
          [sender, track4K],
          [sender, track4K],
        ]);

        addedStep.resolve(undefined);

        expect(await replacing).toEqual([{ status: 'rejected', reason: error }]);
        expect(applyParameters.mock.calls).toEqual([
          [sender, track4K],
          [sender, track4K],
          [sender],
        ]);
        expect(sender.track).toBe(track720);
      });
    });

    describe('ошибки', () => {
      it('должен залогировать ошибку применения параметров с учётом нового трека, заменить трек, применить его параметры и запросить балансировку', async () => {
        const error = new Error('setParameters failed');

        applyParameters.mockRejectedValueOnce(error);

        await sender.replaceTrack(track4K);

        expect(mcuDebugLogger).toHaveBeenCalledWith(
          'applyParameters before replaceTrack: error',
          error,
        );
        expect(log).toEqual([...REPLACE_TRACK_LOG, ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG]);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
        expect(requestBalance).toHaveBeenCalledTimes(1);
        expect(sender.track).toBe(track4K);
      });

      it('должен залогировать ошибку применения параметров нового трека после замены, завершить замену и запросить балансировку', async () => {
        const error = new Error('setParameters failed');

        applyParameters.mockImplementationOnce(applyLoggedParameters);
        applyParameters.mockRejectedValueOnce(error);

        await sender.replaceTrack(track4K);

        expect(mcuDebugLogger).toHaveBeenCalledWith(
          'applyParameters after replaceTrack: error',
          error,
        );
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
        expect(requestBalance).not.toHaveBeenCalled();
        expect(sender.track).toBe(track720);
      });

      it('должен отклонить замену на пустой трек ошибкой оригинального replaceTrack, не применяя параметры', async () => {
        const error = new Error('replaceTrack failed');

        originalReplaceTrack.mockRejectedValueOnce(error);

        await expect(sender.replaceTrack(NO_TRACK)).rejects.toBe(error);
        expect(applyParameters).not.toHaveBeenCalled();
        expect(requestBalance).not.toHaveBeenCalled();
      });

      it('должен отклонить замену ошибкой оригинального replaceTrack и залогировать ошибку возврата параметров оставшегося трека', async () => {
        const replaceTrackError = new Error('replaceTrack failed');
        const restoreError = new Error('restore failed');

        originalReplaceTrack.mockRejectedValueOnce(replaceTrackError);
        applyParameters.mockImplementationOnce(applyLoggedParameters);
        applyParameters.mockRejectedValueOnce(restoreError);

        await expect(sender.replaceTrack(track4K)).rejects.toBe(replaceTrackError);
        expect(mcuDebugLogger).toHaveBeenCalledWith(
          'applyParameters after replaceTrack: error',
          restoreError,
        );
      });
    });

    describe('балансировка не запущена', () => {
      beforeEach(() => {
        isStarted = false;
      });

      it('должен заменить трек через очередь отправителя, не применяя параметры и не запрашивая балансировку', async () => {
        const runningTask = Promise.withResolvers<undefined>();
        const running = taskQueue.add(sender, async () => {
          return runningTask.promise;
        });
        const replacing = sender.replaceTrack(track4K);

        await settleQueue();

        expect(originalReplaceTrack).not.toHaveBeenCalled();

        runningTask.resolve(undefined);
        await Promise.all([running, replacing]);

        expect(log).toEqual(REPLACE_TRACK_LOG);
        expect(applyParameters).not.toHaveBeenCalled();
        expect(requestBalance).not.toHaveBeenCalled();
        expect(sender.track).toBe(track4K);
      });

      it('не должен возвращать параметры, если замена отклонена ошибкой оригинального replaceTrack', async () => {
        const error = new Error('replaceTrack failed');

        originalReplaceTrack.mockRejectedValueOnce(error);

        await expect(sender.replaceTrack(track4K)).rejects.toBe(error);
        expect(applyParameters).not.toHaveBeenCalled();
      });

      it('должен применить параметры нового трека после замены и запросить балансировку, если балансировка запущена за время оригинального replaceTrack', async () => {
        const originalReplacement = Promise.withResolvers<undefined>();

        originalReplaceTrackGate = originalReplacement.promise;

        const replacing = sender.replaceTrack(track4K);

        await settleQueue();
        isStarted = true;
        originalReplacement.resolve(undefined);
        await replacing;

        expect(applyParameters.mock.calls).toEqual([[sender]]);
        expect(requestBalance).toHaveBeenCalledTimes(1);
      });
    });

    describe('отправитель исключён к завершению замены', () => {
      beforeEach(() => {
        isExcluded = true;
      });

      it.each([
        ['при запущенной балансировке', true],
        ['во время прогрева', false],
      ])(
        'должен отключить отправителя после успешной замены %s и вернуть ему оригинальный replaceTrack',
        async (_name, isStartedValue) => {
          isStarted = isStartedValue;
          await sender.replaceTrack(track4K);
          hangSenderQueue();
          sender.replaceTrack(track720).catch(() => {});
          await settleQueue();

          expect(trackReplacer.attachedSender).toBeUndefined();
          expect(sender.track).toBe(track720);
        },
      );

      it('должен отключить отправителя после замены, отклонённой ошибкой оригинального replaceTrack, и вернуть ему оригинальный replaceTrack', async () => {
        const error = new Error('replaceTrack failed');

        originalReplaceTrack.mockRejectedValueOnce(error);

        await expect(sender.replaceTrack(track4K)).rejects.toBe(error);

        hangSenderQueue();
        sender.replaceTrack(track4K).catch(() => {});
        await settleQueue();

        expect(trackReplacer.attachedSender).toBeUndefined();
        expect(sender.track).toBe(track4K);
      });
    });

    describe('остановка балансировки во время применения параметров с учётом нового трека', () => {
      it('не должен повторять применение параметров и применять параметры после замены, если балансировка остановлена, а отправитель остался подключён', async () => {
        applyParameters.mockImplementationOnce(async () => {
          isStarted = false;

          return { isChanged: true };
        });

        await sender.replaceTrack(track4K);

        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(requestBalance).not.toHaveBeenCalled();
        expect(sender.track).toBe(track4K);
      });
    });

    describe('отключение во время применения параметров с учётом нового трека', () => {
      it('не должен повторять применение параметров и применять параметры после замены, если отправитель отключён', async () => {
        applyParameters.mockImplementationOnce(async () => {
          trackReplacer.detach();

          return { isChanged: true };
        });

        await sender.replaceTrack(track4K);

        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(requestBalance).not.toHaveBeenCalled();
        expect(sender.track).toBe(track4K);
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

      it('не должен применять параметры после замены и запрашивать балансировку, если отправитель отключён', async () => {
        trackReplacer.detach();
        originalReplacement.resolve(undefined);
        await replacing;

        expect(requestBalance).not.toHaveBeenCalled();
        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(sender.track).toBe(track4K);
      });

      it('должен выполнить замену, вызванную после отключения, только после незавершённой, не применяя параметры и не запрашивая балансировку', async () => {
        trackReplacer.detach();

        const nextReplacing = sender.replaceTrack(track720);

        await settleQueue();

        expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);

        originalReplacement.resolve(undefined);
        await Promise.all([replacing, nextReplacing]);

        expect(originalReplaceTrack.mock.calls).toEqual([[track4K], [track720]]);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(requestBalance).not.toHaveBeenCalled();
        expect(sender.track).toBe(track720);
      });

      it('должен вернуть параметры оставшегося трека, если отправитель отключён во время замены, а оригинальный replaceTrack отклонён', async () => {
        const error = new Error('replaceTrack failed');

        trackReplacer.detach();
        originalReplacement.reject(error);

        await expect(replacing).rejects.toBe(error);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
        expect(requestBalance).not.toHaveBeenCalled();
        expect(sender.track).toBe(track720);
      });

      it('не должен возвращать параметры, если замена, вызванная после отключения, отклонена ошибкой оригинального replaceTrack', async () => {
        const error = new Error('replaceTrack failed');

        trackReplacer.detach();

        const nextReplacing = Promise.allSettled([sender.replaceTrack(track720)]);

        originalReplaceTrack.mockRejectedValueOnce(error);
        originalReplacement.resolve(undefined);
        await replacing;

        expect(await nextReplacing).toEqual([{ status: 'rejected', reason: error }]);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(sender.track).toBe(track4K);
      });

      it('должен оставить перехват на прежнем отправителе до завершения принятых им замен и вернуть ему оригинальный replaceTrack один раз, если подключён другой отправитель', async () => {
        const otherTrack = createVideoTrack(1920, 1080);
        const externalReplaceTrack = jest.fn();

        trackReplacer.attach(new RTCRtpSenderMock({ track: otherTrack }));

        const nextReplacing = sender.replaceTrack(track720);

        await settleQueue();

        expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);

        originalReplacement.resolve(undefined);
        await Promise.all([replacing, nextReplacing]);
        hangSenderQueue();
        sender.replaceTrack(track4K).catch(() => {});
        await settleQueue();

        expect(sender.track).toBe(track4K);
        expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
        expect(requestBalance).not.toHaveBeenCalled();

        sender.replaceTrack = externalReplaceTrack;
        trackReplacer.detach();

        expect(sender.replaceTrack).toBe(externalReplaceTrack);
      });

      it('должен вернуть отправителю оригинальный replaceTrack после завершения замен, принятых до отключения', async () => {
        trackReplacer.detach();
        originalReplacement.resolve(undefined);
        await replacing;
        hangSenderQueue();
        sender.replaceTrack(track720).catch(() => {});
        await settleQueue();

        expect(sender.track).toBe(track720);
      });

      it('должен применить параметры после замены и запросить балансировку, если отправитель подключён снова', async () => {
        trackReplacer.detach();
        trackReplacer.attach(sender);
        originalReplacement.resolve(undefined);
        await replacing;

        expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
        expect(requestBalance).toHaveBeenCalledTimes(1);
      });

      it('должен применить параметры перед заменой, принятой до отключения, и после неё, если к её выполнению отправитель подключён снова', async () => {
        const nextReplacing = sender.replaceTrack(track720);

        trackReplacer.detach();
        trackReplacer.attach(sender);
        originalReplacement.resolve(undefined);
        await Promise.all([replacing, nextReplacing]);

        expect(applyParameters.mock.calls).toEqual([
          [sender, track4K],
          [sender],
          [sender, track720],
          [sender],
        ]);
        expect(originalReplaceTrack.mock.calls).toEqual([[track4K], [track720]]);
        expect(requestBalance).toHaveBeenCalledTimes(2);
      });
    });

    describe('ожидание зависшей записи', () => {
      // не дольше этого вызывающий replaceTrack ждёт зависшие записи в отправитель
      const WRITE_WAIT_TIMEOUT_MS = 1000;
      // столько длится задержанный оригинальный replaceTrack в сценариях с записями после него
      const ORIGINAL_REPLACE_TRACK_DURATION_MS = 200;

      const PENDING = { status: 'pending' } as const;
      const FULFILLED = { status: 'fulfilled', value: undefined };
      const WRITE_START = 'write:start';
      const WRITE_END = 'write:end';
      const APPLY_UPCOMING_TRACK_PARAMETERS_START = APPLY_UPCOMING_TRACK_PARAMETERS_LOG[0];
      const APPLY_UPCOMING_TRACK_PARAMETERS_END = APPLY_UPCOMING_TRACK_PARAMETERS_LOG[1];
      const APPLY_ACTUAL_TRACK_PARAMETERS_START = APPLY_ACTUAL_TRACK_PARAMETERS_LOG[0];

      let track1080: MediaStreamVideoTrack;
      let startTime: number;
      let writesInFlight: number;
      let maxWritesInFlight: number;

      // время сценария: t = 0 — начало теста
      const advanceTo = async (time: number) => {
        await jest.advanceTimersByTimeAsync(startTime + time - jest.now());
      };

      const flush = async () => {
        await jest.advanceTimersByTimeAsync(0);
      };

      // исход промиса, видимый в любой момент сценария без ожидания
      const observeSettlement = (promise: Promise<void>) => {
        const settlement: { result: PromiseSettledResult<void> | typeof PENDING } = {
          result: PENDING,
        };

        promise.then(
          (value) => {
            settlement.result = { status: 'fulfilled', value };
          },
          (error: unknown) => {
            settlement.result = { status: 'rejected', reason: error };
          },
        );

        return settlement;
      };

      // запись в отправитель с журналом и счётчиком одновременных записей; gate задерживает её завершение
      const writeWithLog = async (step: string, gate?: Promise<unknown>) => {
        log.push(`${step}:start`);
        writesInFlight += 1;
        maxWritesInFlight = Math.max(maxWritesInFlight, writesInFlight);

        try {
          await flushPromises();
          await gate;
        } finally {
          writesInFlight -= 1;
        }

        log.push(`${step}:end`);
      };

      const resolveApplyStep = (upcomingTrack?: MediaStreamTrack) => {
        return upcomingTrack ? 'applyParameters(upcomingTrack)' : 'applyParameters()';
      };

      const applyCountedParameters = async (
        _sender: RTCRtpSender,
        upcomingTrack?: MediaStreamTrack,
      ) => {
        await writeWithLog(resolveApplyStep(upcomingTrack));

        return { isChanged: false };
      };

      // следующее применение параметров не завершится, пока его не отпустят
      const deferNextApplyParameters = () => {
        const release = Promise.withResolvers<undefined>();

        applyParameters.mockImplementationOnce(async (_sender, upcomingTrack) => {
          await writeWithLog(resolveApplyStep(upcomingTrack), release.promise);

          return { isChanged: true };
        });

        return release;
      };

      // W: запись в очереди отправителя, которая не завершится, пока её не отпустят
      const startHungWrite = () => {
        const release = Promise.withResolvers<undefined>();

        taskQueue
          .add(sender, async () => {
            return writeWithLog('write', release.promise);
          })
          .catch(() => {});

        return release;
      };

      beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });

        startTime = jest.now();
        track1080 = createVideoTrack(1920, 1080);
        writesInFlight = 0;
        maxWritesInFlight = 0;
        applyParameters.mockImplementation(applyCountedParameters);
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      describe('зависшая запись в очереди до замены', () => {
        it('должен вызвать оригинальный replaceTrack без подготовки и завершить замену через таймаут ожидания, а после записи применить параметры фактического трека', async () => {
          const write = startHungWrite();
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS - 1);

          expect(log).toEqual([WRITE_START]);
          expect(originalReplaceTrack).not.toHaveBeenCalled();

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG]);
          expect(replacement.result).toEqual(FULFILLED);
          expect(sender.track).toBe(track4K);
          expect(applyParameters).not.toHaveBeenCalled();
          expect(requestBalance).toHaveBeenCalledTimes(1);

          write.resolve(undefined);
          await flush();

          expect(log).toEqual([
            WRITE_START,
            ...REPLACE_TRACK_LOG,
            WRITE_END,
            ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
          ]);
          expect(applyParameters.mock.calls).toEqual([[sender]]);
          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(requestBalance).toHaveBeenCalledTimes(1);
          expect(maxWritesInFlight).toBe(1);
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен вызвать оригинальный replaceTrack(null) и завершить замену через таймаут ожидания, не запрашивая балансировку', async () => {
          const write = startHungWrite();
          const replacement = observeSettlement(sender.replaceTrack(NO_TRACK));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS - 1);

          expect(originalReplaceTrack).not.toHaveBeenCalled();

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG]);
          expect(replacement.result).toEqual(FULFILLED);
          expect(sender.track).toBeNull();
          expect(applyParameters).not.toHaveBeenCalled();

          write.resolve(undefined);
          await flush();

          expect(log).toEqual([
            WRITE_START,
            ...REPLACE_TRACK_LOG,
            WRITE_END,
            ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
          ]);
          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(requestBalance).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен отклонить замену ошибкой оригинального replaceTrack, вызванного через таймаут ожидания, и не применять параметры ни до, ни после зависшей записи', async () => {
          const error = new Error('replaceTrack failed');
          const write = startHungWrite();

          originalReplaceTrack.mockRejectedValueOnce(error);

          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS - 1);

          expect(originalReplaceTrack).not.toHaveBeenCalled();

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);
          expect(replacement.result).toEqual({ status: 'rejected', reason: error });
          expect(requestBalance).not.toHaveBeenCalled();

          write.resolve(undefined);
          // здесь задача замены завершается той же ошибкой: необработанный отказ Jest засчитал бы этому тесту
          await flush();

          expect(log).toEqual([WRITE_START, WRITE_END]);
          expect(applyParameters).not.toHaveBeenCalled();
          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(requestBalance).not.toHaveBeenCalled();
          expect(sender.track).toBe(track720);
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен вызывать оригинальные replaceTrack ждущих замен по порядку и отсчитывать таймаут следующей от завершения оригинала предыдущей', async () => {
          const write = startHungWrite();
          const firstReplacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS / 2);

          const secondReplacement = observeSettlement(sender.replaceTrack(track1080));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG]);
          expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);
          expect(firstReplacement.result).toEqual(FULFILLED);
          expect(secondReplacement.result).toEqual(PENDING);

          await advanceTo(2 * WRITE_WAIT_TIMEOUT_MS - 1);

          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);

          await advanceTo(2 * WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG, ...REPLACE_TRACK_LOG]);
          expect(originalReplaceTrack.mock.calls).toEqual([[track4K], [track1080]]);
          expect(secondReplacement.result).toEqual(FULFILLED);

          write.resolve(undefined);
          await flush();

          expect(log).toEqual([
            WRITE_START,
            ...REPLACE_TRACK_LOG,
            ...REPLACE_TRACK_LOG,
            WRITE_END,
            ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
            ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
          ]);
          expect(applyParameters.mock.calls).toEqual([[sender], [sender]]);
          expect(sender.track).toBe(track1080);
          expect(maxWritesInFlight).toBe(1);
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен вызвать оригинальный replaceTrack следующей замены только через таймаут после завершения задержанного оригинала предыдущей, не пересекая их', async () => {
          const firstOriginalDurationMs = 3 * WRITE_WAIT_TIMEOUT_MS;
          const firstOriginalReplacement = Promise.withResolvers<undefined>();
          const write = startHungWrite();

          originalReplaceTrackGate = firstOriginalReplacement.promise;

          const firstReplacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS / 2);

          const secondReplacement = observeSettlement(sender.replaceTrack(track1080));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, REPLACE_TRACK_LOG[0]]);

          await advanceTo(firstOriginalDurationMs);

          expect(firstReplacement.result).toEqual(PENDING);

          firstOriginalReplacement.resolve(undefined);
          await flush();

          expect(firstReplacement.result).toEqual(FULFILLED);

          await advanceTo(firstOriginalDurationMs + WRITE_WAIT_TIMEOUT_MS - 1);

          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(secondReplacement.result).toEqual(PENDING);

          await advanceTo(firstOriginalDurationMs + WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG, ...REPLACE_TRACK_LOG]);
          expect(originalReplaceTrack.mock.calls).toEqual([[track4K], [track1080]]);
          expect(secondReplacement.result).toEqual(FULFILLED);

          write.resolve(undefined);
          await flush();

          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен выполнить замену обычным порядком, если зависшая запись завершилась до таймаута ожидания', async () => {
          const write = startHungWrite();
          const replacing = sender.replaceTrack(track4K).then(() => {
            log.push('replaced');
          });

          await advanceTo(WRITE_WAIT_TIMEOUT_MS - 1);
          write.resolve(undefined);
          await flush();

          expect(log).toEqual([WRITE_START, WRITE_END, ...TRACK_REPLACEMENT_LOG, 'replaced']);

          await advanceTo(3 * WRITE_WAIT_TIMEOUT_MS);

          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(log).toEqual([WRITE_START, WRITE_END, ...TRACK_REPLACEMENT_LOG, 'replaced']);
          expect(jest.getTimerCount()).toBe(0);

          await replacing;
        });
      });

      describe('зависшее звено подготовки', () => {
        it('должен вызвать оригинальный replaceTrack и завершить замену через таймаут ожидания, а после звена применить параметры фактического трека', async () => {
          const preparation = deferNextApplyParameters();
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS - 1);

          expect(log).toEqual([APPLY_UPCOMING_TRACK_PARAMETERS_START]);
          expect(originalReplaceTrack).not.toHaveBeenCalled();

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([APPLY_UPCOMING_TRACK_PARAMETERS_START, ...REPLACE_TRACK_LOG]);
          expect(replacement.result).toEqual(FULFILLED);
          expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
          expect(requestBalance).toHaveBeenCalledTimes(1);

          preparation.resolve(undefined);
          await flush();

          expect(log).toEqual([
            APPLY_UPCOMING_TRACK_PARAMETERS_START,
            ...REPLACE_TRACK_LOG,
            APPLY_UPCOMING_TRACK_PARAMETERS_END,
            ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
          ]);
          expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(maxWritesInFlight).toBe(1);
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен отклонить замену через таймаут ожидания ошибкой оригинального replaceTrack, не дожидаясь отката, и вернуть параметры оставшегося трека после звена', async () => {
          const error = new Error('replaceTrack failed');
          const preparation = deferNextApplyParameters();

          originalReplaceTrack.mockRejectedValueOnce(error);

          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(originalReplaceTrack).toHaveBeenCalledWith(track4K);
          expect(replacement.result).toEqual({ status: 'rejected', reason: error });
          expect(applyParameters.mock.calls).toEqual([[sender, track4K]]);
          expect(requestBalance).not.toHaveBeenCalled();

          preparation.resolve(undefined);
          // здесь задача замены завершается откатом и той же ошибкой: необработанный отказ Jest засчитал бы этому тесту
          await flush();

          expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(sender.track).toBe(track720);
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен применить звено, добавленное после вызова оригинального replaceTrack по таймауту, только после зависшего звена и до параметров фактического трека', async () => {
          const preparation = deferNextApplyParameters();
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([APPLY_UPCOMING_TRACK_PARAMETERS_START, ...REPLACE_TRACK_LOG]);
          expect(replacement.result).toEqual(FULFILLED);

          trackReplacer.prepareOngoingReplacement();
          await flush();

          expect(log).toEqual([APPLY_UPCOMING_TRACK_PARAMETERS_START, ...REPLACE_TRACK_LOG]);
          expect(applyParameters).toHaveBeenCalledTimes(1);

          preparation.resolve(undefined);
          await flush();

          expect(log).toEqual([
            APPLY_UPCOMING_TRACK_PARAMETERS_START,
            ...REPLACE_TRACK_LOG,
            APPLY_UPCOMING_TRACK_PARAMETERS_END,
            ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
            ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
          ]);
          expect(maxWritesInFlight).toBe(1);
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен выполнить замену обычным порядком, если звено подготовки завершилось до таймаута ожидания', async () => {
          const preparation = deferNextApplyParameters();
          const replacing = sender.replaceTrack(track4K).then(() => {
            log.push('replaced');
          });

          await advanceTo(WRITE_WAIT_TIMEOUT_MS - 1);
          preparation.resolve(undefined);
          await flush();

          expect(log).toEqual([...TRACK_REPLACEMENT_LOG, 'replaced']);

          await advanceTo(3 * WRITE_WAIT_TIMEOUT_MS);

          expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
          expect(log).toEqual([...TRACK_REPLACEMENT_LOG, 'replaced']);
          expect(jest.getTimerCount()).toBe(0);

          await replacing;
        });
      });

      describe('долгий оригинальный replaceTrack', () => {
        it('должен выполнить обе замены обычным порядком, если оригинальный replaceTrack первой длится дольше таймаута ожидания, а записи быстрые', async () => {
          const originalReplaceTrackDurationMs = 5 * WRITE_WAIT_TIMEOUT_MS;
          const originalReplacement = Promise.withResolvers<undefined>();
          let logOnFirstReplaced: string[] = [];

          originalReplaceTrackGate = originalReplacement.promise;

          const firstReplacing = sender.replaceTrack(track4K).then(() => {
            logOnFirstReplaced = [...log];
          });

          await advanceTo(WRITE_WAIT_TIMEOUT_MS / 2);

          const secondReplacing = sender.replaceTrack(track1080);

          await advanceTo(originalReplaceTrackDurationMs);
          originalReplacement.resolve(undefined);
          await flush();

          expect(log).toEqual([...TRACK_REPLACEMENT_LOG, ...TRACK_REPLACEMENT_LOG]);
          expect(logOnFirstReplaced.slice(0, TRACK_REPLACEMENT_LOG.length)).toEqual(
            TRACK_REPLACEMENT_LOG,
          );
          expect(originalReplaceTrack.mock.calls).toEqual([[track4K], [track1080]]);
          expect(sender.track).toBe(track1080);
          expect(jest.getTimerCount()).toBe(0);

          await Promise.all([firstReplacing, secondReplacing]);
        });
      });

      describe('зависшая запись после оригинального replaceTrack', () => {
        let originalReplacement: PromiseWithResolvers<undefined>;

        beforeEach(() => {
          originalReplacement = Promise.withResolvers<undefined>();
          originalReplaceTrackGate = originalReplacement.promise;
        });

        it('должен завершить замену через таймаут ожидания после конца оригинального replaceTrack, если зависло звено, добавленное во время него, а после звена применить параметры фактического трека', async () => {
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await flush();

          const addedStep = deferNextApplyParameters();

          trackReplacer.prepareOngoingReplacement();
          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS);
          originalReplacement.resolve(undefined);
          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_WAIT_TIMEOUT_MS - 1);

          expect(sender.track).toBe(track4K);
          expect(replacement.result).toEqual(PENDING);

          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_WAIT_TIMEOUT_MS);

          expect(replacement.result).toEqual(FULFILLED);
          expect(requestBalance).toHaveBeenCalledTimes(1);
          expect(applyParameters.mock.calls).toEqual([
            [sender, track4K],
            [sender, track4K],
          ]);

          addedStep.resolve(undefined);
          await flush();

          expect(applyParameters.mock.calls).toEqual([
            [sender, track4K],
            [sender, track4K],
            [sender],
          ]);
          expect(maxWritesInFlight).toBe(1);
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен завершить замену через таймаут ожидания после конца оригинального replaceTrack, если зависло применение параметров фактического трека', async () => {
          applyParameters.mockImplementationOnce(applyCountedParameters);

          const actualTrackParameters = deferNextApplyParameters();
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS);
          originalReplacement.resolve(undefined);
          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_WAIT_TIMEOUT_MS - 1);

          expect(log).toEqual(TRACK_REPLACEMENT_LOG.slice(0, -1));
          expect(replacement.result).toEqual(PENDING);

          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_WAIT_TIMEOUT_MS);

          expect(replacement.result).toEqual(FULFILLED);
          expect(requestBalance).toHaveBeenCalledTimes(1);

          actualTrackParameters.resolve(undefined);
          await flush();

          expect(log).toEqual(TRACK_REPLACEMENT_LOG);
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен отклонить замену ошибкой оригинального replaceTrack через таймаут ожидания после его конца, если завис возврат параметров оставшегося трека', async () => {
          const error = new Error('replaceTrack failed');

          applyParameters.mockImplementationOnce(applyCountedParameters);

          const rollback = deferNextApplyParameters();
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS);
          originalReplacement.reject(error);
          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_WAIT_TIMEOUT_MS - 1);

          expect(log).toEqual([
            ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
            REPLACE_TRACK_LOG[0],
            APPLY_ACTUAL_TRACK_PARAMETERS_START,
          ]);
          expect(replacement.result).toEqual(PENDING);

          await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_WAIT_TIMEOUT_MS);

          expect(replacement.result).toEqual({ status: 'rejected', reason: error });
          expect(requestBalance).not.toHaveBeenCalled();

          rollback.resolve(undefined);
          // здесь задача замены завершается той же ошибкой: необработанный отказ Jest засчитал бы этому тесту
          await flush();

          expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
          expect(sender.track).toBe(track720);
          expect(jest.getTimerCount()).toBe(0);
        });
      });

      describe('записи отправителя идут друг за другом дольше таймаута ожидания, но каждая быстрее него', () => {
        // столько длится каждая независшая запись: две подряд дольше таймаута ожидания
        const WRITE_DURATION_MS = 600;
        const REPLACED = 'replaced';

        // запись в очереди отправителя, которая длится WRITE_DURATION_MS
        const startTimedWrite = () => {
          taskQueue
            .add(sender, async () => {
              return writeWithLog('write', delayPromise(WRITE_DURATION_MS));
            })
            .catch(() => {});
        };

        // следующее применение параметров длится durationMs
        const delayNextApplyParameters = (durationMs: number) => {
          applyParameters.mockImplementationOnce(async (_sender, upcomingTrack) => {
            await writeWithLog(resolveApplyStep(upcomingTrack), delayPromise(durationMs));

            return { isChanged: true };
          });
        };

        // в журнал попадает и момент, когда замена завершилась для вызывающего
        const replaceTrackWithLog = (track: MediaStreamTrack) => {
          return observeSettlement(
            sender.replaceTrack(track).then(() => {
              log.push(REPLACED);
            }),
          );
        };

        describe('до оригинального replaceTrack', () => {
          it('должен выполнить замену обычным порядком после двух записей в очереди', async () => {
            const expectedLog = [
              WRITE_START,
              WRITE_END,
              WRITE_START,
              WRITE_END,
              ...TRACK_REPLACEMENT_LOG,
              REPLACED,
            ];

            startTimedWrite();
            startTimedWrite();

            const replacement = replaceTrackWithLog(track4K);

            await advanceTo(2 * WRITE_DURATION_MS - 1);

            expect(originalReplaceTrack).not.toHaveBeenCalled();
            expect(log).toEqual([WRITE_START, WRITE_END, WRITE_START]);
            expect(replacement.result).toEqual(PENDING);

            await advanceTo(2 * WRITE_DURATION_MS);

            expect(log).toEqual(expectedLog);
            expect(replacement.result).toEqual(FULFILLED);
            expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
            expect(requestBalance).toHaveBeenCalledTimes(1);
            expect(sender.track).toBe(track4K);

            await advanceTo(2 * WRITE_DURATION_MS + 3 * WRITE_WAIT_TIMEOUT_MS);

            expect(log).toEqual(expectedLog);
            expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);
            expect(maxWritesInFlight).toBe(1);
            expect(jest.getTimerCount()).toBe(0);
          });

          it('должен вызвать оригинальный replaceTrack только после подготовки, если она идёт за записью в очереди', async () => {
            startTimedWrite();
            delayNextApplyParameters(WRITE_DURATION_MS);

            const replacement = replaceTrackWithLog(track4K);

            await advanceTo(2 * WRITE_DURATION_MS - 1);

            expect(originalReplaceTrack).not.toHaveBeenCalled();
            expect(log).toEqual([WRITE_START, WRITE_END, APPLY_UPCOMING_TRACK_PARAMETERS_START]);
            expect(replacement.result).toEqual(PENDING);

            await advanceTo(2 * WRITE_DURATION_MS);

            expect(log).toEqual([WRITE_START, WRITE_END, ...TRACK_REPLACEMENT_LOG, REPLACED]);
            expect(replacement.result).toEqual(FULFILLED);
            expect(applyParameters.mock.calls).toEqual([[sender, track4K], [sender]]);
            expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);
            expect(requestBalance).toHaveBeenCalledTimes(1);
            expect(maxWritesInFlight).toBe(1);
            expect(jest.getTimerCount()).toBe(0);
          });

          it('должен вызвать оригинальный replaceTrack только после звена, добавленного во время подготовки, если подготовка идёт за записью в очереди', async () => {
            startTimedWrite();
            applyParameters.mockImplementationOnce(async (_sender, upcomingTrack) => {
              trackReplacer.prepareOngoingReplacement();
              await writeWithLog(resolveApplyStep(upcomingTrack), delayPromise(WRITE_DURATION_MS));

              return { isChanged: true };
            });
            delayNextApplyParameters(WRITE_DURATION_MS);

            const replacement = replaceTrackWithLog(track4K);

            await advanceTo(3 * WRITE_DURATION_MS - 1);

            expect(originalReplaceTrack).not.toHaveBeenCalled();
            expect(log).toEqual([
              WRITE_START,
              WRITE_END,
              ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
              APPLY_UPCOMING_TRACK_PARAMETERS_START,
            ]);
            expect(replacement.result).toEqual(PENDING);

            await advanceTo(3 * WRITE_DURATION_MS);

            expect(log).toEqual([
              WRITE_START,
              WRITE_END,
              ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
              ...TRACK_REPLACEMENT_LOG,
              REPLACED,
            ]);
            expect(replacement.result).toEqual(FULFILLED);
            expect(applyParameters.mock.calls).toEqual([
              [sender, track4K],
              [sender, track4K],
              [sender],
            ]);
            expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);
            expect(maxWritesInFlight).toBe(1);
            expect(jest.getTimerCount()).toBe(0);
          });

          it('должен вызвать оригинальный replaceTrack без подготовки через таймаут ожидания после конца последней завершённой записи, если следующая запись в очереди зависла', async () => {
            startTimedWrite();

            const write = startHungWrite();
            const replacement = replaceTrackWithLog(track4K);

            await advanceTo(WRITE_DURATION_MS + WRITE_WAIT_TIMEOUT_MS - 1);

            expect(originalReplaceTrack).not.toHaveBeenCalled();
            expect(log).toEqual([WRITE_START, WRITE_END, WRITE_START]);
            expect(replacement.result).toEqual(PENDING);

            await advanceTo(WRITE_DURATION_MS + WRITE_WAIT_TIMEOUT_MS);

            expect(log).toEqual([
              WRITE_START,
              WRITE_END,
              WRITE_START,
              ...REPLACE_TRACK_LOG,
              REPLACED,
            ]);
            expect(replacement.result).toEqual(FULFILLED);
            expect(sender.track).toBe(track4K);
            expect(applyParameters).not.toHaveBeenCalled();
            expect(requestBalance).toHaveBeenCalledTimes(1);

            write.resolve(undefined);
            await flush();

            expect(log).toEqual([
              WRITE_START,
              WRITE_END,
              WRITE_START,
              ...REPLACE_TRACK_LOG,
              REPLACED,
              WRITE_END,
              ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
            ]);
            expect(applyParameters.mock.calls).toEqual([[sender]]);
            expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
            expect(maxWritesInFlight).toBe(1);
            expect(jest.getTimerCount()).toBe(0);
          });

          it('не должен продлевать таймаут ожидания зависшей записи записями в очереди другого отправителя', async () => {
            const otherWriteDurationMs = 500;
            const otherWritesCount = 4;
            const otherSender = new RTCRtpSenderMock({ track: track1080 });
            let otherWritesDone = 0;

            const write = startHungWrite();

            Array.from({ length: otherWritesCount }).forEach(() => {
              taskQueue
                .add(otherSender, async () => {
                  await delayPromise(otherWriteDurationMs);
                  otherWritesDone += 1;
                })
                .catch(() => {});
            });

            const replacement = replaceTrackWithLog(track4K);

            await advanceTo(WRITE_WAIT_TIMEOUT_MS - 1);

            expect(otherWritesDone).toBe(1);
            expect(originalReplaceTrack).not.toHaveBeenCalled();

            await advanceTo(WRITE_WAIT_TIMEOUT_MS);

            expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG, REPLACED]);
            expect(replacement.result).toEqual(FULFILLED);
            expect(applyParameters).not.toHaveBeenCalled();

            write.resolve(undefined);
            await advanceTo(otherWritesCount * otherWriteDurationMs);

            expect(otherWritesDone).toBe(otherWritesCount);
            expect(log).toEqual([
              WRITE_START,
              ...REPLACE_TRACK_LOG,
              REPLACED,
              WRITE_END,
              ...APPLY_ACTUAL_TRACK_PARAMETERS_LOG,
            ]);
            expect(applyParameters.mock.calls).toEqual([[sender]]);
            expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
            expect(jest.getTimerCount()).toBe(0);
          });
        });

        describe('после оригинального replaceTrack', () => {
          // звено, добавленное во время оригинального replaceTrack, завершается через WRITE_DURATION_MS после его конца
          const ADDED_STEP_END_TIME = ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_DURATION_MS;
          const LOG_UNTIL_ACTUAL_TRACK_PARAMETERS_END = [
            ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
            REPLACE_TRACK_LOG[0],
            APPLY_UPCOMING_TRACK_PARAMETERS_START,
            REPLACE_TRACK_LOG[1],
            APPLY_UPCOMING_TRACK_PARAMETERS_END,
            APPLY_ACTUAL_TRACK_PARAMETERS_START,
          ];

          let originalReplacement: PromiseWithResolvers<undefined>;

          // замена до конца оригинального replaceTrack; звено добавлено во время него
          const startReplacementWithAddedStep = async () => {
            const replacement = replaceTrackWithLog(track4K);

            await flush();
            delayNextApplyParameters(ADDED_STEP_END_TIME);
            trackReplacer.prepareOngoingReplacement();

            return replacement;
          };

          beforeEach(() => {
            originalReplacement = Promise.withResolvers<undefined>();
            originalReplaceTrackGate = originalReplacement.promise;
          });

          it('должен завершить замену после применения параметров фактического трека, если оно идёт за звеном, добавленным во время оригинального replaceTrack', async () => {
            const replacement = await startReplacementWithAddedStep();

            delayNextApplyParameters(WRITE_DURATION_MS);
            await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS);
            originalReplacement.resolve(undefined);
            await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_WAIT_TIMEOUT_MS);

            expect(replacement.result).toEqual(PENDING);
            expect(log).toEqual(LOG_UNTIL_ACTUAL_TRACK_PARAMETERS_END);

            await advanceTo(ADDED_STEP_END_TIME + WRITE_DURATION_MS - 1);

            expect(replacement.result).toEqual(PENDING);

            await advanceTo(ADDED_STEP_END_TIME + WRITE_DURATION_MS);

            expect(log).toEqual([
              ...LOG_UNTIL_ACTUAL_TRACK_PARAMETERS_END,
              APPLY_ACTUAL_TRACK_PARAMETERS_LOG[1],
              REPLACED,
            ]);
            expect(replacement.result).toEqual(FULFILLED);
            expect(applyParameters.mock.calls).toEqual([
              [sender, track4K],
              [sender, track4K],
              [sender],
            ]);
            expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
            expect(requestBalance).toHaveBeenCalledTimes(1);
            expect(maxWritesInFlight).toBe(1);
            expect(jest.getTimerCount()).toBe(0);
          });

          it('должен отклонить замену ошибкой оригинального replaceTrack после возврата параметров оставшегося трека, если возврат идёт за звеном, добавленным во время оригинального replaceTrack', async () => {
            const error = new Error('replaceTrack failed');
            const logUntilRollbackEnd = [
              ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
              REPLACE_TRACK_LOG[0],
              ...APPLY_UPCOMING_TRACK_PARAMETERS_LOG,
              APPLY_ACTUAL_TRACK_PARAMETERS_START,
            ];
            const replacement = await startReplacementWithAddedStep();

            delayNextApplyParameters(WRITE_DURATION_MS);
            await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS);
            originalReplacement.reject(error);
            await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS + WRITE_WAIT_TIMEOUT_MS);

            expect(replacement.result).toEqual(PENDING);
            expect(log).toEqual(logUntilRollbackEnd);

            await advanceTo(ADDED_STEP_END_TIME + WRITE_DURATION_MS - 1);

            expect(replacement.result).toEqual(PENDING);

            await advanceTo(ADDED_STEP_END_TIME + WRITE_DURATION_MS);

            expect(replacement.result).toEqual({ status: 'rejected', reason: error });
            expect(log).toEqual([...logUntilRollbackEnd, APPLY_ACTUAL_TRACK_PARAMETERS_LOG[1]]);
            expect(applyParameters.mock.calls).toEqual([
              [sender, track4K],
              [sender, track4K],
              [sender],
            ]);
            expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
            expect(requestBalance).not.toHaveBeenCalled();
            expect(sender.track).toBe(track720);
            expect(maxWritesInFlight).toBe(1);
            expect(jest.getTimerCount()).toBe(0);
          });

          it('должен завершить замену через таймаут ожидания после конца звена, добавленного во время оригинального replaceTrack, если зависло следующее за ним применение параметров фактического трека', async () => {
            const replacement = await startReplacementWithAddedStep();
            const actualTrackParameters = deferNextApplyParameters();

            await advanceTo(ORIGINAL_REPLACE_TRACK_DURATION_MS);
            originalReplacement.resolve(undefined);
            await advanceTo(ADDED_STEP_END_TIME + WRITE_WAIT_TIMEOUT_MS - 1);

            expect(replacement.result).toEqual(PENDING);
            expect(log).toEqual(LOG_UNTIL_ACTUAL_TRACK_PARAMETERS_END);

            await advanceTo(ADDED_STEP_END_TIME + WRITE_WAIT_TIMEOUT_MS);

            expect(replacement.result).toEqual(FULFILLED);
            expect(requestBalance).toHaveBeenCalledTimes(1);

            actualTrackParameters.resolve(undefined);
            await flush();

            expect(log).toEqual([
              ...LOG_UNTIL_ACTUAL_TRACK_PARAMETERS_END,
              REPLACED,
              APPLY_ACTUAL_TRACK_PARAMETERS_LOG[1],
            ]);
            expect(applyParameters.mock.calls).toEqual([
              [sender, track4K],
              [sender, track4K],
              [sender],
            ]);
            expect(originalReplaceTrack).toHaveBeenCalledTimes(1);
            expect(maxWritesInFlight).toBe(1);
            expect(jest.getTimerCount()).toBe(0);
          });
        });
      });

      describe('отправитель перестаёт быть подключённым во время ожидания', () => {
        it('должен вызвать оригинальный replaceTrack и завершить замену через таймаут ожидания, если отправитель отключён, вернуть ему оригинальный replaceTrack и не применять параметры', async () => {
          const write = startHungWrite();
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS / 2);
          trackReplacer.detach();
          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG]);
          expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);
          expect(replacement.result).toEqual(FULFILLED);
          expect(requestBalance).not.toHaveBeenCalled();

          // запись всё ещё висит: через перехват замена ждала бы её до таймаута
          const nextReplacement = observeSettlement(sender.replaceTrack(track720));

          await flush();

          expect(nextReplacement.result).toEqual(FULFILLED);
          expect(sender.track).toBe(track720);

          write.resolve(undefined);
          await flush();

          expect(applyParameters).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(0);
        });

        it('должен вызвать оригинальный replaceTrack и завершить замену через таймаут ожидания, если отправитель исключён, отключить его, вернуть ему оригинальный replaceTrack и не применять параметры', async () => {
          const write = startHungWrite();
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS / 2);
          isExcluded = true;
          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG]);
          expect(originalReplaceTrack.mock.calls).toEqual([[track4K]]);
          expect(replacement.result).toEqual(FULFILLED);
          expect(trackReplacer.attachedSender).toBeUndefined();
          expect(requestBalance).not.toHaveBeenCalled();

          // запись всё ещё висит: через перехват замена ждала бы её до таймаута
          const nextReplacement = observeSettlement(sender.replaceTrack(track720));

          await flush();

          expect(nextReplacement.result).toEqual(FULFILLED);
          expect(sender.track).toBe(track720);

          write.resolve(undefined);
          await flush();

          expect(applyParameters).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(0);
        });
      });

      describe('балансировка не запущена', () => {
        it('должен вызвать оригинальный replaceTrack через таймаут ожидания зависшей записи и не применять параметры ни до, ни после неё', async () => {
          isStarted = false;

          const write = startHungWrite();
          const replacement = observeSettlement(sender.replaceTrack(track4K));

          await advanceTo(WRITE_WAIT_TIMEOUT_MS - 1);

          expect(originalReplaceTrack).not.toHaveBeenCalled();

          await advanceTo(WRITE_WAIT_TIMEOUT_MS);

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG]);
          expect(replacement.result).toEqual(FULFILLED);

          write.resolve(undefined);
          await flush();

          expect(log).toEqual([WRITE_START, ...REPLACE_TRACK_LOG, WRITE_END]);
          expect(applyParameters).not.toHaveBeenCalled();
          expect(requestBalance).not.toHaveBeenCalled();
          expect(jest.getTimerCount()).toBe(0);
        });
      });
    });
  });
});
