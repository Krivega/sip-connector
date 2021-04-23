import debounce from 'lodash/debounce';
import type { IncomingInfoEvent } from '@krivega/jssip/lib/RTCSession';
import type SipConnector from '..';
import {
  HEADER_CONTENT_TYPE_MAIN_CAM,
  HEADER_MAIN_CAM,
  HEADER_MAIN_CAM_RESOLUTION,
} from '../headers';
import type { MainCAM } from './processSender';
import processSender from './processSender';

const processSenderDebounced = debounce(processSender, 100);

const findSenderVideo = (senders: RTCRtpSender[]): RTCRtpSender | undefined => {
  return senders.find((sender) => {
    return sender?.track?.kind === 'video';
  });
};

const resolveVideoSendingBalancer = (sipConnector: SipConnector) => {
  let mainCam: MainCAM;
  let resolutionMainCam: string;

  const balance = () => {
    const { connection } = sipConnector;

    if (!connection) {
      return;
    }

    const senders = connection.getSenders();
    const sender = findSenderVideo(senders);

    if (sender) {
      processSenderDebounced({ mainCam, resolutionMainCam, sender });
    }
  };

  sipConnector.onSession('newInfo', (event: IncomingInfoEvent) => {
    const { info, request } = event;
    const { contentType } = info;

    mainCam = request.getHeader(HEADER_MAIN_CAM) as MainCAM;
    resolutionMainCam = request.getHeader(HEADER_MAIN_CAM_RESOLUTION);

    if (contentType === HEADER_CONTENT_TYPE_MAIN_CAM) {
      balance();
    }
  });

  return balance;
};

export default resolveVideoSendingBalancer;
