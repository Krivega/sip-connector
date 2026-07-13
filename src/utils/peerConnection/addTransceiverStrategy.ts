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
): Promise<RTCRtpTransceiver | undefined> => {
  const direction = options.direction ?? 'sendrecv';

  const transceiver = (() => {
    if (!isFirefoxOrLower(SUPPORTED_FIREFOX_VERSION_FOR_ADD_TRANSCEIVER)) {
      return connection.addTransceiver(track, {
        direction,
        sendEncodings: options.sendEncodings,
      });
    }

    connection.addTrack(track);

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

export const addVideoTrackInTransceiver = async (
  connection: RTCPeerConnection,
  videoTrack: MediaStreamVideoTrack,
  options: TTransceiverOptions,
): Promise<void> => {
  const transceiver = await addTrackTransceiver(connection, videoTrack, options);

  if (options.onAddedTransceiver !== undefined && transceiver !== undefined) {
    await options.onAddedTransceiver(transceiver, videoTrack);
  }
};
