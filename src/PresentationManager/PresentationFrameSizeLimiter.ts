import { SetTimeoutRequest } from '@krivega/timeout-requester';

import resolveDebug from '@/logger';
import resolveSendEncodings from '@/tools/resolveSendEncodings';
import { setParametersToSender } from '@/tools/setParametersToSender';
import { calcScaleByEncoderFrameLimit } from '@/VideoSendingBalancer/calcResolution';

import type { TResolutionSize } from '@/types';

const debug = resolveDebug('PresentationFrameSizeLimiter');

// Без нарастания интервала: захватываемое окно может вырасти в любой момент демонстрации
const RECONCILE_INTERVAL_MS = 1000;
const SCALE_RESOLUTION_DOWN_BY_DEFAULT = 1;

type TFrameSizeOptions = {
  sendEncodings?: RTCRtpEncodingParameters[];
  maxResolution?: TResolutionSize;
};

export const resolvePresentationSendEncodings = ({
  videoTrack,
  sendEncodings,
  maxResolution,
}: TFrameSizeOptions & {
  videoTrack: MediaStreamVideoTrack;
}): RTCRtpEncodingParameters[] | undefined => {
  return resolveSendEncodings({
    videoTrack,
    sendEncodings,
    maxResolution,
    minScaleResolutionDownBy: calcScaleByEncoderFrameLimit({ videoTrack }),
  });
};

const applyFrameSizeLimit = (
  sender: RTCRtpSender,
  { sendEncodings, maxResolution }: TFrameSizeOptions,
): void => {
  const videoTrack = sender.track as MediaStreamVideoTrack | null;

  if (videoTrack === null) {
    return;
  }

  const resolvedSendEncodings = resolvePresentationSendEncodings({
    videoTrack,
    sendEncodings,
    maxResolution,
  });
  const presentationSendEncodings =
    resolvedSendEncodings === undefined || resolvedSendEncodings.length === 0
      ? [{}]
      : resolvedSendEncodings;
  // Явный scale 1 (и при пустом sendEncodings) снимает уменьшение прежнего кадра и прошлой
  // демонстрации на том же sender; maxBitrate не передаём, чтобы не менять битрейт демонстрации
  const encodings = presentationSendEncodings.map(({ scaleResolutionDownBy }) => {
    return { scaleResolutionDownBy: scaleResolutionDownBy ?? SCALE_RESOLUTION_DOWN_BY_DEFAULT };
  });

  // Текущий degradationPreference: иначе сверка сбрасывала бы его и писала в sender каждый тик
  const { degradationPreference } = sender.getParameters();

  // Следующая сверка повторит запись, поэтому ошибку только логируем
  setParametersToSender(sender, { encodings, degradationPreference }).catch((error: unknown) => {
    debug('apply frame size limit: error', error);
  });
};

/**
 * Держит кадр активной демонстрации в пределе H.264-энкодера и maxResolution,
 * когда размер трека меняется без его замены (например, растёт захватываемое окно).
 * Сверяет scale с нужным раз в секунду, поэтому восстанавливает и отклонённую, и перезаписанную запись.
 */
class PresentationFrameSizeLimiter {
  private readonly reconcileRequest = new SetTimeoutRequest();

  public watch(sender: RTCRtpSender, options: TFrameSizeOptions): void {
    const reconcile = () => {
      applyFrameSizeLimit(sender, options);
      this.reconcileRequest.request(reconcile, RECONCILE_INTERVAL_MS);
    };

    reconcile();
  }

  public stop(): void {
    this.reconcileRequest.cancelRequest();
  }
}

export default PresentationFrameSizeLimiter;
