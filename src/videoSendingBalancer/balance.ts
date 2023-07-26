import type { EEventsMainCAM } from '../SipConnector';
import findVideoSender from '../utils/findVideoSender';
import getCodecFromSender from '../utils/getCodecFromSender';
import processSender from './processSender';
import hasIncludesString from './hasIncludesString';
import type { TOnSetParameters } from './setEncodingsToSender';

const balance = async ({
  mainCam,
  resolutionMainCam,
  connection,
  onSetParameters,
  ignoreForCodec,
}: {
  mainCam: EEventsMainCAM;
  resolutionMainCam?: string;
  connection: RTCPeerConnection;
  onSetParameters?: TOnSetParameters;
  ignoreForCodec?: string;
}) => {
  const senders = connection.getSenders();
  const sender = findVideoSender(senders);

  if (!sender || !sender.track) {
    return;
  }

  const codec = await getCodecFromSender(sender);

  if (hasIncludesString(codec, ignoreForCodec)) {
    return;
  }

  processSender(
    { mainCam, resolutionMainCam, sender, codec, track: sender.track },
    onSetParameters,
  );
};

export default balance;
