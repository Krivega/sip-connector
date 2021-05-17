import createStackPromises from 'stack-promises';
import { MainCAM } from '../SipConnector';
import setEncodingsToSender from './setEncodingsToSender';

const stackPromises = createStackPromises();

const runStackPromises = () => {
  stackPromises().catch((error) => {
    // eslint-disable-next-line no-console
    console.debug('videoSendingBalancer: error', error);
  });
};

const run = (action: () => Promise<any>) => {
  stackPromises.add(action);
  runStackPromises();
};

const addToStackScaleResolutionDownBySender = (
  sender: RTCRtpSender,
  scaleResolutionDownByTarget: number
) => {
  run(() => {
    return setEncodingsToSender(sender, { scaleResolutionDownBy: scaleResolutionDownByTarget });
  });
};

const downgradeResolutionSender = (sender: RTCRtpSender): void => {
  const scaleResolutionDownByTarget = 200;

  addToStackScaleResolutionDownBySender(sender, scaleResolutionDownByTarget);
};

const resetScaleResolutionSender = (sender: RTCRtpSender): void => {
  const scaleResolutionDownByTarget = 1;

  addToStackScaleResolutionDownBySender(sender, scaleResolutionDownByTarget);
};

const setResolutionSender = ({
  sender,
  track,
  resolution,
}: {
  sender: RTCRtpSender;
  track: MediaStreamTrack;
  resolution: string;
}): void => {
  const [widthTarget, heightTarget] = resolution.split('x');

  const settings = track.getSettings();
  const widthCurrent = settings.width!;
  const heightCurrent = settings.height!;

  const scaleByWidth = widthCurrent / +widthTarget;
  const scaleByHeight = heightCurrent / +heightTarget!;
  const SCALE_MIN = 1;

  const scaleResolutionDownByTarget = Math.max(scaleByWidth, scaleByHeight, SCALE_MIN);

  addToStackScaleResolutionDownBySender(sender, scaleResolutionDownByTarget);
};

const processSender = ({
  mainCam,
  resolutionMainCam,
  sender,
  track,
}: {
  mainCam: MainCAM;
  resolutionMainCam: string;
  sender: RTCRtpSender;
  track: MediaStreamTrack;
}): void => {
  switch (mainCam) {
    case MainCAM.PAUSE_MAIN_CAM:
      downgradeResolutionSender(sender);
      break;
    case MainCAM.RESUME_MAIN_CAM:
      resetScaleResolutionSender(sender);
      break;
    case MainCAM.MAX_MAIN_CAM_RESOLUTION:
      setResolutionSender({ sender, track, resolution: resolutionMainCam });
      break;
  }
};

export default processSender;
