import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { DEFAULT_SCALE_RESOLUTION_DOWN_BY } from './constants';

export type TSenderLogEntry =
  | { type: 'setParameters'; scaleResolutionDownBy?: number }
  | { type: 'replaceTrack'; appliedScaleResolutionDownBy?: number };

export type TObservedSender = {
  sender: RTCRtpSender;
  // применённые setParameters и вызовы replaceTrack отправителя (с масштабом, действовавшим в момент замены)
  log: TSenderLogEntry[];
  getAppliedEncoding: () => RTCRtpEncodingParameters;
  // меняет параметры отправителя так, как это делает другой модуль: мимо балансировщика
  applyForeignEncoding: (encoding: RTCRtpEncodingParameters) => Promise<void>;
  rejectNextSetParameters: (error: Error) => void;
  // откладывает применение ближайшей записи, для которой matches вернёт true (без условия — ближайшей записи)
  deferNextSetParameters: (
    matches?: (encoding: RTCRtpEncodingParameters) => boolean,
  ) => PromiseWithResolvers<undefined>;
  // следующий setParameters не завершается никогда
  hangNextSetParameters: () => void;
  rejectNextReplaceTrack: (error: Error) => void;
  deferNextReplaceTrack: () => PromiseWithResolvers<undefined>;
  // следующий оригинальный replaceTrack не завершается никогда (как при закрытии соединения во время замены)
  hangNextReplaceTrack: () => void;
};

type TSetParametersGate = {
  matches: (encoding: RTCRtpEncodingParameters) => boolean;
  wait: () => Promise<void>;
};

const waitForever = async (): Promise<void> => {
  return new Promise<void>(() => {});
};

const matchesAnyEncoding = () => {
  return true;
};

const normalizeEncoding = (encoding: RTCRtpEncodingParameters): RTCRtpEncodingParameters => {
  return {
    scaleResolutionDownBy: encoding.scaleResolutionDownBy ?? DEFAULT_SCALE_RESOLUTION_DOWN_BY,
    maxBitrate: encoding.maxBitrate,
  };
};

/**
 * Отправитель с журналом: replaceTrack здесь — «оригинальный» метод отправителя,
 * который был на нём до подключения балансировщика.
 * getParameters отдаёт снимок encodings, поэтому отклонённый setParameters не меняет параметры отправителя.
 * setParameters — как в спецификации W3C: параметры сверяются с последним getParameters при вызове, гейт задерживает
 * только применение, записи применяются в порядке вызовов, а пока запись не применена, getParameters отдаёт прежние
 * параметры. Chromium отдаёт новые параметры сразу после вызова, поэтому фикстура строже него
 */
const createObservedSender = (track: MediaStreamVideoTrack): TObservedSender => {
  const senderMock = new RTCRtpSenderMock({ track });
  const sender = senderMock as RTCRtpSender;
  const log: TSenderLogEntry[] = [];
  const originalGetParameters = sender.getParameters.bind(sender);
  const originalReplaceTrack = sender.replaceTrack.bind(sender);
  const setParametersGates: TSetParametersGate[] = [];
  const replaceTrackGates: (() => Promise<void>)[] = [];
  let appliedEncoding: RTCRtpEncodingParameters = {
    scaleResolutionDownBy: DEFAULT_SCALE_RESOLUTION_DOWN_BY,
  };
  // вызванные, но ещё не применённые или не отклонённые записи и завершение последней из них
  let pendingApplications = 0;
  let lastApplication: Promise<void> = Promise.resolve();

  const takeSetParametersGate = (
    parameters: RTCRtpSendParameters,
  ): (() => Promise<void>) | undefined => {
    const index = setParametersGates.findIndex((gate) => {
      return gate.matches(parameters.encodings[0]);
    });

    return index === -1 ? undefined : setParametersGates.splice(index, 1)[0].wait;
  };

  const pushSetParametersGate = (
    wait: () => Promise<void>,
    matches: TSetParametersGate['matches'] = matchesAnyEncoding,
  ) => {
    setParametersGates.push({ matches, wait });
  };

  sender.getParameters = () => {
    const parameters = originalGetParameters();

    parameters.encodings = parameters.encodings.map((encoding) => {
      return { ...encoding };
    });

    return parameters;
  };

  sender.setParameters = async (parameters: RTCRtpSendParameters) => {
    // сверка — при вызове: поздний getParameters уже вызванную запись не отменяет
    senderMock.checkParameters(parameters);

    const gate = takeSetParametersGate(parameters);
    const apply = () => {
      senderMock.applyParameters(parameters);
      appliedEncoding = normalizeEncoding(parameters.encodings[0]);
      log.push({
        type: 'setParameters',
        scaleResolutionDownBy: appliedEncoding.scaleResolutionDownBy,
      });
    };

    if (!gate && pendingApplications === 0) {
      apply();

      return;
    }

    const previous = lastApplication;

    pendingApplications += 1;

    const application = (async () => {
      try {
        await previous;
        await gate?.();
        apply();
      } finally {
        pendingApplications -= 1;
      }
    })();

    lastApplication = application.catch(() => {});

    await application;
  };

  sender.replaceTrack = async (newTrack: MediaStreamTrack | null) => {
    log.push({
      type: 'replaceTrack',
      appliedScaleResolutionDownBy: appliedEncoding.scaleResolutionDownBy,
    });

    const gate = replaceTrackGates.shift();

    if (gate) {
      await gate();
    }

    return originalReplaceTrack(newTrack);
  };

  return {
    sender,
    log,
    getAppliedEncoding: () => {
      return appliedEncoding;
    },
    applyForeignEncoding: async (encoding: RTCRtpEncodingParameters) => {
      const parameters = sender.getParameters();

      parameters.encodings = [{ ...parameters.encodings[0], ...encoding }];

      await sender.setParameters(parameters);
    },
    rejectNextSetParameters: (error: Error) => {
      pushSetParametersGate(async () => {
        throw error;
      });
    },
    deferNextSetParameters: (matches) => {
      const deferred = Promise.withResolvers<undefined>();

      pushSetParametersGate(async () => {
        await deferred.promise;
      }, matches);

      return deferred;
    },
    hangNextSetParameters: () => {
      pushSetParametersGate(waitForever);
    },
    rejectNextReplaceTrack: (error: Error) => {
      replaceTrackGates.push(async () => {
        throw error;
      });
    },
    deferNextReplaceTrack: () => {
      const deferred = Promise.withResolvers<undefined>();

      replaceTrackGates.push(async () => {
        await deferred.promise;
      });

      return deferred;
    },
    hangNextReplaceTrack: () => {
      replaceTrackGates.push(waitForever);
    },
  };
};

export default createObservedSender;
