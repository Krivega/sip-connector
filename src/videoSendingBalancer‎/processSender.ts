import createStackPromises from 'stack-promises';
import { EEventsMainCAM } from '../SipConnector';
import setEncodingsToSender from './setEncodingsToSender';
import getMaxBitrateByWidth, { MINIMUM_BITRATE, MAXIMUM_BITRATE } from './getMaxBitrateByWidth';

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
  scaleResolutionDownBy: number,
  maxBitrate: number
) => {
  run(() => {
    return setEncodingsToSender(sender, { scaleResolutionDownBy, maxBitrate });
  });
};

const downgradeResolutionSender = (sender: RTCRtpSender): void => {
  const scaleResolutionDownByTarget = 200;
  const maxBitrate = MINIMUM_BITRATE;

  addToStackScaleResolutionDownBySender(sender, scaleResolutionDownByTarget, maxBitrate);
};

const resetScaleResolutionSender = (sender: RTCRtpSender): void => {
  const scaleResolutionDownByTarget = 1;
  const maxBitrate = MAXIMUM_BITRATE;

  addToStackScaleResolutionDownBySender(sender, scaleResolutionDownByTarget, maxBitrate);
};

const setResolutionSender = (
  sender: RTCRtpSender,
  {
    track,
    resolution,
  }: {
    track: MediaStreamTrack;
    resolution: string;
  }
): void => {
  const settings = track.getSettings();
  const widthCurrent = settings.width!;
  const heightCurrent = settings.height!;
  const [widthTarget, heightTarget] = resolution.split('x');

  const scaleByWidth = widthCurrent / +widthTarget;
  const scaleByHeight = heightCurrent / +heightTarget!;
  const SCALE_MIN = 1;

  const scaleResolutionDownByTarget = Math.max(scaleByWidth, scaleByHeight, SCALE_MIN);

  const maxBitrate = getMaxBitrateByWidth(+widthTarget);

  addToStackScaleResolutionDownBySender(sender, scaleResolutionDownByTarget, maxBitrate);
};

const processSender = ({
  mainCam,
  resolutionMainCam,
  sender,
  track,
}: {
  mainCam: EEventsMainCAM;
  resolutionMainCam: string;
  sender: RTCRtpSender;
  track: MediaStreamTrack;
}): void => {
  switch (mainCam) {
    case EEventsMainCAM.PAUSE_MAIN_CAM:
      downgradeResolutionSender(sender);
      break;
    case EEventsMainCAM.RESUME_MAIN_CAM:
      resetScaleResolutionSender(sender);
      break;
    case EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION:
      setResolutionSender(sender, { track, resolution: resolutionMainCam });
      break;
  }
};

export default processSender;
