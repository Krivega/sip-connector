import { createManagers } from '@/__fixtures__/createManagers';
import RTCPeerConnectionMock from '@/__fixtures__/RTCPeerConnectionMock';
import {
  createBalancerOptions,
  NO_MAX_RESOLUTION_BALANCER_OPTIONS,
} from '@/VideoSendingBalancer/__fixtures__';
import VideoSendingBalancerManager from '../@VideoSendingBalancerManager';
import {
  BALANCING_START_DELAY,
  confirmCall,
  createObservedSender,
  createVideoTrack,
  deferNextGetStats,
  ENCODING_4K_LIMITED_TO_360P,
  ENCODING_4K_LIMITED_TO_720P,
  ENCODING_720P_BY_TRACK,
  ENCODING_720P_LIMITED_TO_360P,
  ENCODING_PAUSED,
  hangGetStats,
  HEADERS_MAX_360P,
  HEADERS_MAX_4K,
  HEADERS_MAX_720P,
  HEADERS_PAUSE,
  POLL_INTERVAL,
  sendMainCamInfo,
  setConnection,
  settle,
  TRACK_SIZE_POLLING_WINDOW,
} from '../__fixtures__';

import type { ApiManager } from '@/ApiManager';
import type { CallManager } from '@/CallManager';
import type { IBalancerOptions } from '@/VideoSendingBalancer/types';
import type { TObservedSender } from '../__fixtures__';

const NO_TRACK = null;

describe('VideoSendingBalancerManager: замена трека при гонках и ошибках', () => {
  let callManager: CallManager;
  let apiManager: ApiManager;
  let connection: RTCPeerConnectionMock;
  let manager: VideoSendingBalancerManager;
  let observed: TObservedSender;
  let track720: MediaStreamVideoTrack;
  let track4K: MediaStreamVideoTrack;

  const createManager = (options: IBalancerOptions = NO_MAX_RESOLUTION_BALANCER_OPTIONS) => {
    manager = new VideoSendingBalancerManager(callManager, apiManager, options);
  };

  const confirmCallAndWaitBalancingStart = async () => {
    confirmCall(callManager, connection);
    await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
    await settle();
  };

  const sendMaxResolution720p = () => {
    sendMainCamInfo(callManager, HEADERS_MAX_720P);
  };

  const getReplaceTrackEntries = (logLengthBeforeReplace: number) => {
    return observed.log.slice(logLengthBeforeReplace).filter((entry) => {
      return entry.type === 'replaceTrack';
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();

    ({ callManager, apiManager } = createManagers());

    track720 = createVideoTrack(1280, 720);
    track4K = createVideoTrack(3840, 2160);
    observed = createObservedSender(track720);
    connection = new RTCPeerConnectionMock(undefined, []);
    connection.senders = [observed.sender];

    setConnection(callManager, connection as RTCPeerConnection);
  });

  afterEach(() => {
    manager.stopBalancing();
    jest.useRealTimers();
  });

  describe('ошибка setParameters при подготовке замены', () => {
    it('заменяет 720p на 4K и ограничивает новый трек после замены, если при ограничении 1280x720 setParameters перед заменой отклонён', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      observed.rejectNextSetParameters(new Error('setParameters failed'));

      const logLengthBeforeReplace = observed.log.length;
      const [result] = await Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();

      expect(result).toEqual({ status: 'fulfilled', value: undefined });
      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('ошибка подписчика parameters-updated при подготовке замены', () => {
    it('заменяет 720p на 4K и сохраняет ограничение 1280x720, если подписчик бросил исключение после применения параметров перед заменой', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      manager.once('parameters-updated', () => {
        throw new Error('parameters-updated subscriber failed');
      });

      const logLengthBeforeReplace = observed.log.length;
      const [result] = await Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();

      expect(result).toEqual({ status: 'fulfilled', value: undefined });
      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      ]);
      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });
  });

  describe('замена во время незавершённой балансировки', () => {
    it('применяет PAUSE_MAIN_CAM до оригинального replaceTrack, если замена 720p на 4K вызвана, пока балансировка команды ждёт кодек', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();

      const releaseStats = deferNextGetStats(observed.sender);

      sendMainCamInfo(callManager, HEADERS_PAUSE);
      await settle();

      const logLengthBeforeReplace = observed.log.length;
      const replacing = observed.sender.replaceTrack(track4K);

      await settle();
      releaseStats();
      await replacing;
      await settle();

      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 200 },
      ]);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_PAUSED);
    });

    it.each([
      ['получена в прогреве', sendMaxResolution720p, () => {}],
      ['получена после истечения прогрева', () => {}, sendMaxResolution720p],
    ])(
      'выставляет scaleResolutionDownBy 3 до оригинального replaceTrack, если замена 720p на 4K вызвана, пока первая балансировка старта ждёт кодек, а MAX 1280x720 %s',
      async (_name, receiveCommandInWarmup, receiveCommandAfterStart) => {
        createManager();

        const releaseStats = deferNextGetStats(observed.sender);

        confirmCall(callManager, connection);
        receiveCommandInWarmup();
        await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY);
        await settle();
        receiveCommandAfterStart();

        const logLengthBeforeReplace = observed.log.length;
        const replacing = observed.sender.replaceTrack(track4K);

        await settle();
        releaseStats();
        await replacing;
        await settle();

        expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
          { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
        ]);
        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      },
    );
  });

  describe('команда во время замены', () => {
    it('выставляет scaleResolutionDownBy 3, пока оригинальный replaceTrack замены 720p на 4K ещё не завершён, если MAX 1280x720 получена во время замены, и не снижает его после завершения', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      sendMaxResolution720p();
      await settle();

      const scaleDuringReplacement = observed.getAppliedEncoding().scaleResolutionDownBy;
      const logLengthBeforeCompletion = observed.log.length;

      originalReplacement.resolve(undefined);
      await replacing;
      await settle();

      expect(scaleDuringReplacement).toBe(3);
      expect(
        observed.log.slice(logLengthBeforeCompletion).filter((entry) => {
          return entry.type === 'setParameters' && entry.scaleResolutionDownBy !== 3;
        }),
      ).toEqual([]);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('выставляет scaleResolutionDownBy 3 до оригинального replaceTrack при maxAvailableResolution 1920x1080, если MAX 1280x720 получена, пока не завершён setParameters, начатый заменой 720p на 4K', async () => {
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
      await confirmCallAndWaitBalancingStart();

      const logLengthBeforeReplace = observed.log.length;
      const pendingSetParameters = observed.deferNextSetParameters();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      sendMaxResolution720p();
      await settle();
      pendingSetParameters.resolve(undefined);
      await replacing;
      await settle();

      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      ]);
    });

    it('выставляет 4K-треку scaleResolutionDownBy 3 сразу после завершения замены 720p на 4K, если MAX 1280x720 получена во время замены, а getStats не отвечает', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      hangGetStats(observed.sender);
      sendMaxResolution720p();
      await settle();
      originalReplacement.resolve(undefined);
      await replacing;
      await settle();

      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(3);
    });
  });

  describe('замена, начатая во время прогрева', () => {
    it('ограничивает 4K-трек до 1280x720 без новой команды, если замена 720p на 4K начата во время прогрева с запомненной MAX 1280x720, а завершена после старта балансировки', async () => {
      createManager();
      confirmCall(callManager, connection);
      sendMaxResolution720p();
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);
      await settle();
      originalReplacement.resolve(undefined);
      await replacing;
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('ограничивает 4K-трек до 1280x720 сразу после завершения замены, не дожидаясь опроса, если замена 720p на 4K начата во время прогрева с запомненной MAX 1280x720, а завершена после старта балансировки', async () => {
      createManager();
      confirmCall(callManager, connection);
      sendMaxResolution720p();
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);
      await settle();
      originalReplacement.resolve(undefined);
      await replacing;
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('выставляет scaleResolutionDownBy 3 при старте балансировки, пока оригинальный replaceTrack ещё не завершён, если замена 720p на 4K начата во время прогрева с запомненной MAX 1280x720', async () => {
      createManager();
      confirmCall(callManager, connection);
      sendMaxResolution720p();
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);
      await settle();

      const scaleBeforeCompletion = observed.getAppliedEncoding().scaleResolutionDownBy;

      originalReplacement.resolve(undefined);
      await replacing;
      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(scaleBeforeCompletion).toBe(3);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it('оставляет на отправителе трек последней замены и завершает обе, если первая замена начата во время прогрева и задержана, а вторая вызвана после старта балансировки', async () => {
      const track1080 = createVideoTrack(1920, 1080);

      createManager();
      confirmCall(callManager, connection);
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);

      const firstOriginalReplacement = observed.deferNextReplaceTrack();
      const replacements = [observed.sender.replaceTrack(track4K)];

      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY / 2);
      await settle();
      replacements.push(observed.sender.replaceTrack(track1080));
      await settle();
      firstOriginalReplacement.resolve(undefined);

      const results = await Promise.allSettled(replacements);

      await settle();

      expect(manager.isBalancingActive).toBe(true);
      expect(results).toEqual([
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined },
      ]);
      expect(observed.sender.track).toBe(track1080);
    });
  });

  describe('ошибка оригинального replaceTrack при ограничении 1280x720', () => {
    const replaceTrackError = new Error('replaceTrack failed');

    beforeEach(async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      observed.rejectNextReplaceTrack(replaceTrackError);
    });

    it('отклоняет замену 720p на 4K той же ошибкой и восстанавливает параметры оставшегося трека 720p', async () => {
      await expect(observed.sender.replaceTrack(track4K)).rejects.toBe(replaceTrackError);
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
      expect(observed.sender.track).toBe(track720);
    });

    it('отклоняет замену 720p на 4K ошибкой оригинального replaceTrack и оставляет параметры трека 720p, если перед этим отклонён и setParameters подготовки', async () => {
      observed.rejectNextSetParameters(new Error('setParameters failed'));

      const [result] = await Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();

      expect(result).toEqual({ status: 'rejected', reason: replaceTrackError });
      expect(observed.sender.track).toBe(track720);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('выставляет scaleResolutionDownBy 3 до оригинального replaceTrack при следующей замене на 4K после неудачной', async () => {
      await Promise.allSettled([observed.sender.replaceTrack(track4K)]);
      await settle();

      const logLengthBeforeReplace = observed.log.length;

      await observed.sender.replaceTrack(track4K);
      await settle();

      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      ]);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      expect(observed.sender.track).toBe(track4K);
    });
  });

  describe('ошибка отката неудачной замены', () => {
    it('возвращает треку 720p параметры команды MAX 640x360 при ближайшем опросе, если оригинальный replaceTrack замены на 4K и setParameters отката отклонены', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMainCamInfo(callManager, HEADERS_MAX_360P);
      // опрос без изменений дорастает до максимального интервала
      await jest.advanceTimersByTimeAsync(TRACK_SIZE_POLLING_WINDOW);

      const replacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      observed.rejectNextSetParameters(new Error('rollback setParameters failed'));
      replacement.reject(new Error('replaceTrack failed'));
      await replacing;
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_360P);

      await jest.advanceTimersByTimeAsync(POLL_INTERVAL);

      expect(observed.sender.track).toBe(track720);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_LIMITED_TO_360P);
    });
  });

  describe('замена через пустой трек', () => {
    const callManualBalance = () => {
      manager.balance().catch(() => {});
    };

    it('выставляет scaleResolutionDownBy 3 до оригинального replaceTrack при замене пустого трека на 4K, если перед этим трек 720p заменён на пустой через replaceTrack(null)', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      await observed.sender.replaceTrack(NO_TRACK);
      await settle();

      const logLengthBeforeReplace = observed.log.length;

      await observed.sender.replaceTrack(track4K);
      await settle();

      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
      ]);
      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
    });

    it.each([
      ['получена MAX 1280x720', () => {}, sendMaxResolution720p],
      [
        'вызван ручной balance(), а MAX 1280x720 получена до замены на пустой трек',
        sendMaxResolution720p,
        callManualBalance,
      ],
    ])(
      'выставляет scaleResolutionDownBy 3 до оригинального replaceTrack при замене пустого трека на 4K, если между заменой на пустой трек и заменой на 4K %s',
      async (_name, actBeforeEmptyTrack, actBetweenReplacements) => {
        createManager();
        await confirmCallAndWaitBalancingStart();
        actBeforeEmptyTrack();
        await settle();
        await observed.sender.replaceTrack(NO_TRACK);
        await settle();
        actBetweenReplacements();
        await settle();

        const logLengthBeforeReplace = observed.log.length;

        await observed.sender.replaceTrack(track4K);
        await settle();

        expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
          { type: 'replaceTrack', appliedScaleResolutionDownBy: 3 },
        ]);
        expect(observed.sender.track).toBe(track4K);
        expect(observed.getAppliedEncoding()).toEqual(ENCODING_4K_LIMITED_TO_720P);
      },
    );

    it('возвращает scaleResolutionDownBy 1 к замене пустого трека на 4K после stopBalancing, если 4K-трек с ограничением 1280x720 заменён на пустой до остановки', async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();
      await observed.sender.replaceTrack(NO_TRACK);
      await settle();
      manager.stopBalancing();
      await settle();
      await observed.sender.replaceTrack(track4K);
      await settle();

      expect(observed.sender.track).toBe(track4K);
      expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(1);
    });
  });

  describe('остановка балансировки во время замены', () => {
    it('восстанавливает параметры оставшегося трека 720p, если stopBalancing вызван во время замены на 4K, а оригинальный replaceTrack затем отклонён', async () => {
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
      await confirmCallAndWaitBalancingStart();

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      manager.stopBalancing();
      await settle();
      originalReplacement.reject(new Error('replaceTrack failed'));
      await replacing;
      await settle();

      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
      expect(observed.sender.track).toBe(track720);
    });

    it('возвращает треку 720p параметры по треку сбросом остановки, если stopBalancing вызван во время замены на 4K при ограничении 1280x720, а оригинальный replaceTrack и setParameters отката затем отклонены', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      manager.stopBalancing();
      observed.rejectNextSetParameters(new Error('rollback setParameters failed'));
      originalReplacement.reject(new Error('replaceTrack failed'));
      await replacing;
      await settle();

      expect(observed.sender.track).toBe(track720);
      expect(observed.getAppliedEncoding()).toEqual(ENCODING_720P_BY_TRACK);
    });

    it('отклоняет замену 720p на 4K ошибкой оригинального replaceTrack и возвращает треку 720p scaleResolutionDownBy 1 вместо выставленного заменой 2, если stopBalancing вызван во время замены, а getStats сброса параметров не отвечает', async () => {
      const replaceTrackError = new Error('replaceTrack failed');

      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
      await confirmCallAndWaitBalancingStart();

      const logLengthBeforeReplace = observed.log.length;
      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      hangGetStats(observed.sender);
      manager.stopBalancing();
      await settle();
      originalReplacement.reject(replaceTrackError);

      const [result] = await replacing;

      await settle();

      expect(result).toEqual({ status: 'rejected', reason: replaceTrackError });
      expect(getReplaceTrackEntries(logLengthBeforeReplace)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 2 },
      ]);
      expect(observed.sender.track).toBe(track720);
      expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(1);
    });

    it('сохраняет scaleResolutionDownBy 3 для 4K-трека, если замена 720p на 4K начата до stopBalancing, а завершена после startBalancing и повторной MAX 1280x720, когда getStats перестал отвечать', async () => {
      createManager();
      await confirmCallAndWaitBalancingStart();
      sendMaxResolution720p();
      await settle();

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([observed.sender.replaceTrack(track4K)]);

      await settle();
      manager.stopBalancing();

      const starting = manager.startBalancing();

      await settle();
      sendMaxResolution720p();
      await settle();
      hangGetStats(observed.sender);

      const logLengthBeforeCompletion = observed.log.length;

      originalReplacement.resolve(undefined);
      await replacing;
      await starting;
      await settle();

      expect(observed.sender.track).toBe(track4K);
      expect(
        observed.log.slice(logLengthBeforeCompletion).filter((entry) => {
          return entry.type === 'setParameters' && entry.scaleResolutionDownBy !== 3;
        }),
      ).toEqual([]);
      expect(observed.getAppliedEncoding().scaleResolutionDownBy).toBe(3);
    });
  });

  describe('новый прогрев во время замены', () => {
    it('не ужесточает параметры до конца нового прогрева при maxAvailableResolution 1920x1080, если замена 4K-трека на другой 4K-трек при MAX 3840x2160 завершилась после recv-session-started и recv-session-ended', async () => {
      observed = createObservedSender(track4K);
      connection.senders = [observed.sender];
      createManager(createBalancerOptions({ maxResolution: { width: 1920, height: 1080 } }));
      await confirmCallAndWaitBalancingStart();
      sendMainCamInfo(callManager, HEADERS_MAX_4K);
      await settle();

      const originalReplacement = observed.deferNextReplaceTrack();
      const replacing = Promise.allSettled([
        observed.sender.replaceTrack(createVideoTrack(3840, 2160)),
      ]);

      await settle();
      callManager.events.trigger('recv-session-started', undefined as never);
      callManager.events.trigger('recv-session-ended', undefined as never);
      await settle();

      const logLengthAfterSchedule = observed.log.length;

      originalReplacement.resolve(undefined);
      await replacing;
      await jest.advanceTimersByTimeAsync(BALANCING_START_DELAY - 1);

      expect(
        observed.log.slice(logLengthAfterSchedule).filter((entry) => {
          return entry.type === 'setParameters' && entry.scaleResolutionDownBy !== 1;
        }),
      ).toEqual([]);
      expect(manager.isBalancingScheduled).toBe(true);
      expect(manager.isBalancingActive).toBe(false);
    });
  });

  describe('порядок замен при остановке балансировки', () => {
    let track360: MediaStreamVideoTrack;
    let track1080: MediaStreamVideoTrack;
    let firstOriginalReplacement: PromiseWithResolvers<undefined>;
    let replacements: Promise<void>[];

    beforeEach(async () => {
      track360 = createVideoTrack(640, 360);
      track1080 = createVideoTrack(1920, 1080);

      createManager();
      await confirmCallAndWaitBalancingStart();

      firstOriginalReplacement = observed.deferNextReplaceTrack();
      replacements = [
        observed.sender.replaceTrack(track360),
        observed.sender.replaceTrack(track1080),
      ];
      await settle();
    });

    it('оставляет на отправителе трек последней замены и завершает все три, если первая задержана, вторая ждёт в очереди, а третья вызвана после stopBalancing и startBalancing', async () => {
      manager.stopBalancing();

      const starting = manager.startBalancing();

      await settle();
      replacements.push(observed.sender.replaceTrack(track4K));
      await settle();
      firstOriginalReplacement.resolve(undefined);

      const results = await Promise.allSettled(replacements);

      await starting;
      await settle();

      expect(results).toEqual([
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined },
      ]);
      expect(observed.sender.track).toBe(track4K);
    });

    it('оставляет на отправителе трек последней замены, если первая задержана, вторая ждёт в очереди, а третья вызвана после stopBalancing без нового запуска', async () => {
      manager.stopBalancing();
      await settle();
      replacements.push(observed.sender.replaceTrack(track4K));
      await settle();
      firstOriginalReplacement.resolve(undefined);
      await Promise.allSettled(replacements);
      await settle();

      expect(observed.sender.track).toBe(track4K);
    });

    it('вызывает оригинальный replaceTrack каждой из трёх замен, если первая задержана, вторая ждёт в очереди, а третья вызвана после stopBalancing', async () => {
      manager.stopBalancing();
      await settle();
      replacements.push(observed.sender.replaceTrack(track4K));
      await settle();
      firstOriginalReplacement.resolve(undefined);
      await Promise.allSettled(replacements);
      await settle();

      expect(getReplaceTrackEntries(0)).toEqual([
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
        { type: 'replaceTrack', appliedScaleResolutionDownBy: 1 },
      ]);
    });
  });
});
