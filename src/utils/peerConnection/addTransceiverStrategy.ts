import { applySenderParams } from './applySenderParams';
import { isFirefoxOrLower } from './isFirefoxOrLower';

import type { TTransceiverOptions } from './types';

const SUPPORTED_FIREFOX_VERSION_FOR_ADD_TRANSCEIVER = 109;

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
  options: TTransceiverOptions,
  streams: MediaStream[],
  // eslint-disable-next-line @typescript-eslint/max-params
): Promise<RTCRtpTransceiver | undefined> => {
  const direction = options.direction ?? 'sendrecv';

  const transceiver = (() => {
    if (!isFirefoxOrLower(SUPPORTED_FIREFOX_VERSION_FOR_ADD_TRANSCEIVER)) {
      return connection.addTransceiver(track, {
        direction,
        streams,
        sendEncodings: options.sendEncodings,
      });
    }

    connection.addTrack(track, ...streams);

    return connection.getTransceivers().find((itemTransceiver) => {
      return itemTransceiver.sender.track === track;
    });
  })();

  if (direction !== 'recvonly' && transceiver !== undefined) {
    await applySenderParams(transceiver.sender, {
      sendEncodings: options.sendEncodings,
      degradationPreference: options.degradationPreference,
    });
  }

  return transceiver;
};

export const addTrackInTransceiver = async (
  connection: RTCPeerConnection,
  track: MediaStreamTrack,
  options: TTransceiverOptions,
  streams: MediaStream[] = [],
  // eslint-disable-next-line @typescript-eslint/max-params
): Promise<void> => {
  const transceiver = await addTrackTransceiver(connection, track, options, streams);

  if (options.onAddedTransceiver !== undefined && transceiver !== undefined) {
    await options.onAddedTransceiver(transceiver, track);
  }
};

export const addVideoTrackInTransceiver = async (
  connection: RTCPeerConnection,
  videoTrack: MediaStreamVideoTrack,
  options: TTransceiverOptions,
  streams: MediaStream[] = [],
  // eslint-disable-next-line @typescript-eslint/max-params
): Promise<void> => {
  await addTrackInTransceiver(connection, videoTrack, options, streams);
};
