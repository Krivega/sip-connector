import type SipConnector from '../SipConnector';
import type { EEventsMainCAM } from '../SipConnector';
import processSender from './processSender';
import { getCodecFromSender, findVideoSender } from './utils/index';
import type { TOnSetParameters } from './setEncodingsToSender';

const resolveVideoSendingBalancer = (
  sipConnector: SipConnector,
  autoSubscription = true,
  ignoreForCodec?: string,
  onSetParameters?: TOnSetParameters
) => {
  let mainCam: EEventsMainCAM | undefined;
  let resolutionMainCam: string | undefined;

  const balance = async (onSetParameters?: TOnSetParameters) => {
    const { connection } = sipConnector;

    if (!connection) {
      return;
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);
    let codec: string | undefined;

    if (sender) {
      codec = await getCodecFromSender(sender);
    }

    if (
      sender &&
      sender.track &&
      mainCam !== undefined &&
      resolutionMainCam !== undefined &&
      codec !== ignoreForCodec
    ) {
      processSender({ mainCam, resolutionMainCam, sender, track: sender.track }, onSetParameters);
    }
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
