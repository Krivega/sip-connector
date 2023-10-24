import type { EEventsMainCAM } from '../types';
import findVideoSender from '../utils/findVideoSender';
import getCodecFromSender from '../utils/getCodecFromSender';
import hasIncludesString from './hasIncludesString';
import processSender from './processSender';
import type { TOnSetParameters, TResult } from './setEncodingsToSender';

const resultNoChanged: TResult = {
  isChanged: false,
  parameters: {
    encodings: [{}],
    transactionId: '0',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
  },
};

const balance = async ({
  mainCam,
  resolutionMainCam,
  connection,
  onSetParameters,
  ignoreForCodec,
}: {
  mainCam?: EEventsMainCAM;
  resolutionMainCam?: string;
  connection: RTCPeerConnection;
  onSetParameters?: TOnSetParameters;
  ignoreForCodec?: string;
}) => {
  const senders = connection.getSenders();
  const sender = findVideoSender(senders);

  if (!sender?.track) {
    return resultNoChanged;
  }

  const codec = await getCodecFromSender(sender);

  if (hasIncludesString(codec, ignoreForCodec)) {
    return resultNoChanged;
  }

  return processSender(
    { mainCam, resolutionMainCam, sender, codec, track: sender.track },
    onSetParameters,
  );
};

export default balance;
