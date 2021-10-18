import debounce from 'lodash/debounce';
import type SipConnector from '../SipConnector';
import type { EEventsMainCAM } from '../SipConnector';
import processSender from './processSender';

const processSenderDebounced = debounce(processSender, 100);

const findVideoSender = (senders: RTCRtpSender[]): RTCRtpSender | undefined => {
  return senders.find((sender) => {
    return sender?.track?.kind === 'video';
  });
};

const resolveVideoSendingBalancer = (sipConnector: SipConnector, autoSubscription = true) => {
  let mainCam: EEventsMainCAM | undefined;
  let resolutionMainCam: string | undefined;

  const balance = () => {
    const { connection } = sipConnector;

    if (!connection) {
      return;
    }

    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (sender && sender.track && mainCam !== undefined && resolutionMainCam !== undefined) {
      processSenderDebounced({ mainCam, resolutionMainCam, sender, track: sender.track });
    }
  };

  const handleMainCamControl = (headers: {
    mainCam: EEventsMainCAM;
    resolutionMainCam: string;
  }) => {
    mainCam = headers.mainCam;
    resolutionMainCam = headers.resolutionMainCam;

    balance();
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
