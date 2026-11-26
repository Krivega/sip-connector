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
      trackReplacer.attach(sender);
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
      await sender.replaceTrack(track4K);

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
      // замена через перехват после этого не завершится, вызов оригинального replaceTrack — завершится
      const hangSenderQueue = () => {
        taskQueue
          .add(sender, async () => {
            return new Promise<undefined>(() => {});
          })
          .catch(() => {});
      };

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

      // замена через перехват после этого не завершится, вызов оригинального replaceTrack — завершится
      const hangSenderQueue = () => {
        taskQueue
          .add(sender, async () => {
            return new Promise<undefined>(() => {});
          })
          .catch(() => {});
      };

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
  });
});
