import debounce from 'lodash/debounce';
import type SipConnector from '../SipConnector';
import type { MainCAM } from '../SipConnector';
import processSender from './processSender';

const processSenderDebounced = debounce(processSender, 100);

const findSenderVideo = (senders: RTCRtpSender[]): RTCRtpSender | undefined => {
  return senders.find((sender) => {
    return sender?.track?.kind === 'video';
  });
};

const resolveVideoSendingBalancer = (sipConnector: SipConnector) => {
  let mainCam: MainCAM | undefined;
  let resolutionMainCam: string | undefined;

  const balance = () => {
    const { connection } = sipConnector;

    if (!connection) {
      return;
    }

    const senders = connection.getSenders();
    const sender = findSenderVideo(senders);

    if (sender && sender.track && mainCam !== undefined && resolutionMainCam !== undefined) {
      processSenderDebounced({ mainCam, resolutionMainCam, sender, track: sender.track });
    }
  };

  sipConnector.onSession(
    'main-cam-control',
    (headers: { mainCam: MainCAM; resolutionMainCam: string }) => {
      mainCam = headers.mainCam;
      resolutionMainCam = headers.resolutionMainCam;

      balance();
    }
  );

  return balance;
};

export default resolveVideoSendingBalancer;
