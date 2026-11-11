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
  rejectNextSetParameters: (error: Error) => void;
  // следующий setParameters не завершается никогда
  hangNextSetParameters: () => void;
  rejectNextReplaceTrack: (error: Error) => void;
  deferNextReplaceTrack: () => PromiseWithResolvers<undefined>;
  // следующий оригинальный replaceTrack не завершается никогда (как при закрытии соединения во время замены)
  hangNextReplaceTrack: () => void;
};

const waitForever = async (): Promise<void> => {
  return new Promise<void>(() => {});
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
 * getParameters отдаёт снимок encodings, поэтому отклонённый setParameters не меняет параметры отправителя
 */
const createObservedSender = (track: MediaStreamVideoTrack): TObservedSender => {
  const sender = new RTCRtpSenderMock({ track }) as RTCRtpSender;
  const log: TSenderLogEntry[] = [];
  const originalGetParameters = sender.getParameters.bind(sender);
  const originalSetParameters = sender.setParameters.bind(sender);
  const originalReplaceTrack = sender.replaceTrack.bind(sender);
  const setParametersGates: (() => Promise<void>)[] = [];
  const replaceTrackGates: (() => Promise<void>)[] = [];
  let appliedEncoding: RTCRtpEncodingParameters = {
    scaleResolutionDownBy: DEFAULT_SCALE_RESOLUTION_DOWN_BY,
  };

  sender.getParameters = () => {
    const parameters = originalGetParameters();

    parameters.encodings = parameters.encodings.map((encoding) => {
      return { ...encoding };
    });

    return parameters;
  };

  sender.setParameters = async (parameters: RTCRtpSendParameters) => {
    const gate = setParametersGates.shift();

    if (gate) {
      await gate();
    }

    await originalSetParameters(parameters);

    appliedEncoding = normalizeEncoding(parameters.encodings[0]);
    log.push({
      type: 'setParameters',
      scaleResolutionDownBy: appliedEncoding.scaleResolutionDownBy,
    });
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
    rejectNextSetParameters: (error: Error) => {
      setParametersGates.push(async () => {
        throw error;
      });
    },
    hangNextSetParameters: () => {
      setParametersGates.push(waitForever);
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
