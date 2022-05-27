import type { EEventsMainCAM } from '../SipConnector';
import findVideoSender from '../utils/findVideoSender';
import getCodecFromSender from '../utils/getCodecFromSender';
import processSender from './processSender';
import type { TOnSetParameters } from './setEncodingsToSender';

const hasIncludesString = (source?: string, target?: string): boolean => {
  return !!source && !!target && source.toLowerCase().includes(target.toLowerCase());
};

const balance = async ({
  mainCam,
  resolutionMainCam,
  connection,
  onSetParameters,
  ignoreForCodec,
}: {
  mainCam: EEventsMainCAM;
  resolutionMainCam: string;
  connection: RTCPeerConnection;
  onSetParameters?: TOnSetParameters;
  ignoreForCodec?: string;
}) => {
  const senders = connection.getSenders();
  const sender = findVideoSender(senders);

  if (!sender || !sender.track) {
    return;
  }

  if (ignoreForCodec) {
    const codec = await getCodecFromSender(sender);

    if (hasIncludesString(codec, ignoreForCodec)) {
      return;
    }
  }

  processSender({ mainCam, resolutionMainCam, sender, track: sender.track }, onSetParameters);
};

export default balance;
