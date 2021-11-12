import type SipConnector from '../SipConnector';
import type { EEventsMainCAM } from '../SipConnector';
import findVideoSender from '../utils/findVideoSender';
import getCodecFromSender from '../utils/getCodecFromSender';
import processSender from './processSender';
import type { TOnSetParameters } from './setEncodingsToSender';

const hasIncludesString = (source?: string, target?: string): boolean => {
  return !!source && !!target && source.toLowerCase().includes(target.toLowerCase());
};

const resolveVideoSendingBalancer = (
  sipConnector: SipConnector,
  {
    autoSubscription = true,
    ignoreForCodec,
    onSetParameters,
  }: {
    autoSubscription?: boolean;
    ignoreForCodec?: string;
    onSetParameters?: TOnSetParameters;
  } = {}
) => {
  let mainCam: EEventsMainCAM | undefined;
  let resolutionMainCam: string | undefined;

  const balance = async (onSetParameters?: TOnSetParameters) => {
    const { connection } = sipConnector;

    if (!connection || mainCam === undefined || resolutionMainCam === undefined) {
      return;
    }

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

  const handleMainCamControl = (headers: {
    mainCam: EEventsMainCAM;
    resolutionMainCam: string;
  }) => {
    mainCam = headers.mainCam;
    resolutionMainCam = headers.resolutionMainCam;

    balance(onSetParameters);
  };

  const subscribe = () => {
    sipConnector.onSession('main-cam-control', handleMainCamControl);
  };

  const unsubscribe = () => {
    sipConnector.offSession('main-cam-control', handleMainCamControl);
  };

  if (autoSubscription === true) {
    subscribe();
  }

  return { balance, subscribe, unsubscribe };
};

export default resolveVideoSendingBalancer;
