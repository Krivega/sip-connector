import createStackPromises from 'stack-promises';
import { MainCAM } from '../SipConnector';

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

const scaleResolutionDownBySender = (
  sender: RTCRtpSender,
  scaleResolutionDownByTarget: number
): Promise<any> => {
  const parameters: RTCRtpSendParameters = sender.getParameters();

  if (!parameters.encodings || parameters.encodings.length === 0) {
    parameters.encodings = [{}];
  }

  const scaleResolutionDownByCurrent = parameters.encodings[0].scaleResolutionDownBy;
  const scaleResolutionDownByTargetParsed = Math.max(scaleResolutionDownByTarget, 1);

  const isChangedDefaultScale =
    scaleResolutionDownByCurrent === undefined && scaleResolutionDownByTargetParsed !== 1;
  const isChangedPrevScale =
    scaleResolutionDownByCurrent !== undefined &&
    scaleResolutionDownByTargetParsed !== scaleResolutionDownByCurrent;

  const isNeedToChange = isChangedPrevScale || isChangedDefaultScale;

  if (isNeedToChange) {
    parameters.encodings[0].scaleResolutionDownBy = scaleResolutionDownByTargetParsed;

    return sender.setParameters(parameters);
  }

  return Promise.resolve();
};

const addToStackScaleResolutionDownBySender = (
  sender: RTCRtpSender,
  scaleResolutionDownByTarget: number
) => {
  run(() => {
    return scaleResolutionDownBySender(sender, scaleResolutionDownByTarget);
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
