/* eslint-disable @typescript-eslint/max-params */
import { createUaParser } from '@/tools/createUaParser';
import { setParametersToSender } from '@/tools/setParametersToSender';

import type PresentationSenders from './PresentationSenders';
import type { TOnAddedTransceiver } from './types';

export type TPresentationSessionOptions = {
  direction?: RTCRtpTransceiverDirection;
  directionVideo?: RTCRtpTransceiverDirection;
  sendEncodings?: RTCRtpEncodingParameters[];
  degradationPreference?: RTCDegradationPreference;
  onAddedTransceiver?: TOnAddedTransceiver;
};

const SUPPORTED_FIREFOX_VERSION_FOR_ADD_TRANSCEIVER = 109;

export const isFirefoxOrLower = (version: number): boolean => {
  const { isFirefox, hasLessOrEqualBrowserVersion } = createUaParser();

  return (
    isFirefox &&
    hasLessOrEqualBrowserVersion({
      major: version,
      minor: 0,
      patch: 0,
    })
  );
};

const applySenderParams = async ({
  sender,
  sendEncodings,
  degradationPreference,
}: {
  sender: RTCRtpSender;
  sendEncodings?: RTCRtpEncodingParameters[];
  degradationPreference?: RTCDegradationPreference;
}): Promise<void> => {
  if (sendEncodings === undefined && degradationPreference === undefined) {
    return;
  }

  await setParametersToSender(sender, {
    encodings: sendEncodings,
    degradationPreference,
  });
};

const setTransceiverDirection = (
  transceiver: RTCRtpTransceiver,
  direction: RTCRtpTransceiverDirection,
): void => {
  // @ts-expect-error — setDirection есть не во всех браузерах
  if (typeof transceiver.setDirection === 'function') {
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    transceiver.setDirection(direction);

    return;
  }

  // eslint-disable-next-line no-param-reassign
  (transceiver as { direction: RTCRtpTransceiverDirection }).direction = direction;
};

/**
 * Добавить новый RTCRtpTransceiver к текущему соединению.
 * Это расширенная обёртка над `RTCPeerConnection.addTransceiver()` (см. MDN).
 * Помимо стандартного поведения использует ту же логику, что и `addTrackTransceiver`:
 *  • поддержка Firefox < 109 без `addTransceiver`;
 *  • вызов `setEncodingsToSender` для установки `sendEncodings`/`degradationPreference`;
 */
const addTrackTransceiver = async (
  connection: RTCPeerConnection,
  track: MediaStreamTrack,
  {
    directionVideo = 'sendrecv',
    sendEncodings,
    degradationPreference,
  }: TPresentationSessionOptions,
): Promise<RTCRtpTransceiver | undefined> => {
  const direction = directionVideo;

  // 1. Создаём / получаем трансивер.
  const transceiver = (() => {
    if (!isFirefoxOrLower(SUPPORTED_FIREFOX_VERSION_FOR_ADD_TRANSCEIVER)) {
      return connection.addTransceiver(track, {
        direction,
        sendEncodings,
      });
    }

    connection.addTrack(track);

    return connection.getTransceivers().find((itemTransceiver) => {
      return itemTransceiver.sender.track === track;
    });
  })();

  // 2. Обновляем параметры отправки при необходимости.
  if (direction !== 'recvonly' && transceiver !== undefined) {
    await applySenderParams({
      sender: transceiver.sender,
      sendEncodings,
      degradationPreference,
    });
  }

  // Если направление recvonly — параметров на отправку нет.
  return transceiver;
};

const addVideoTrackInTransceiver = async (
  connection: RTCPeerConnection,
  videoTrack: MediaStreamVideoTrack,
  options: TPresentationSessionOptions,
): Promise<void> => {
  const transceiver = await addTrackTransceiver(connection, videoTrack, options);

  if (options.onAddedTransceiver !== undefined && transceiver !== undefined) {
    await options.onAddedTransceiver(transceiver, videoTrack);
  }
};

const addVideoTrackInSender = async (
  connection: RTCPeerConnection,
  videoTrack: MediaStreamVideoTrack,
  options: TPresentationSessionOptions,
): Promise<void> => {
  const direction = options.directionVideo;
  const sender = connection.addTrack(videoTrack);
  const transceiver = connection.getTransceivers().find((itemTransceiver) => {
    return itemTransceiver.sender === sender;
  });

  if (transceiver !== undefined && direction !== undefined && direction !== transceiver.direction) {
    setTransceiverDirection(transceiver, direction);
  }

  await applySenderParams({
    sender,
    sendEncodings: options.sendEncodings,
    degradationPreference: options.degradationPreference,
  });

  if (options.onAddedTransceiver !== undefined && transceiver !== undefined) {
    await options.onAddedTransceiver(transceiver, videoTrack);
  }
};

export const addOrReplacePresentationVideoTrack = async (
  connection: RTCPeerConnection,
  presentationSenders: PresentationSenders,
  videoTrack: MediaStreamVideoTrack,
  {
    direction,
    directionVideo,
    sendEncodings,
    degradationPreference,
    onAddedTransceiver,
  }: TPresentationSessionOptions = {},
): Promise<void> => {
  const presentationSessionSenders = presentationSenders.getFromConnection(connection);

  if (presentationSessionSenders.length > 0) {
    const [sender] = presentationSessionSenders;

    await sender.replaceTrack(videoTrack);
    await applySenderParams({
      sender,
      sendEncodings,
      degradationPreference,
    });

    return;
  }

  const isExistRecvOnlyTransceiver = connection.getTransceivers().some((itemTransceiver) => {
    return itemTransceiver.currentDirection === 'recvonly';
  });
  const options: TPresentationSessionOptions = {
    directionVideo: direction ?? directionVideo,
    sendEncodings,
    degradationPreference,
    onAddedTransceiver,
  };

  if (isExistRecvOnlyTransceiver) {
    await addVideoTrackInSender(connection, videoTrack, options);

    return;
  }

  await addVideoTrackInTransceiver(connection, videoTrack, options);
};
