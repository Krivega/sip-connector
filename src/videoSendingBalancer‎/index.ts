import type SipConnector from '../SipConnector';
import type { EEventsMainCAM } from '../SipConnector';
import processSender from './processSender';
import type { TOnSetParameters } from './setEncodingsToSender';

const findVideoSender = (senders: RTCRtpSender[]): RTCRtpSender | undefined => {
  return senders.find((sender) => {
    return sender?.track?.kind === 'video';
  });
};

const resolveVideoSendingBalancer = (
  sipConnector: SipConnector,
  autoSubscription = true,
  ignoreForCodecs?: string,
  onSetParameters?: TOnSetParameters
) => {
  let mainCam: EEventsMainCAM | undefined;
  let resolutionMainCam: string | undefined;

  const balance = (onSetParameters?: TOnSetParameters) => {
    const { connection } = sipConnector;

    if (!connection) {
      return;
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (sender && sender.track && mainCam !== undefined && resolutionMainCam !== undefined) {
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
