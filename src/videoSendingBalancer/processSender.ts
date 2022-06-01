import createStackPromises from 'stack-promises';
import { EEventsMainCAM } from '../SipConnector';
import getMaxBitrateByWidth, { MINIMUM_BITRATE, MAXIMUM_BITRATE } from './getMaxBitrateByWidth';
import setEncodingsToSender from './setEncodingsToSender';
import type { TOnSetParameters, TResult } from './setEncodingsToSender';

const stackPromises = createStackPromises<TResult>();

const runStackPromises = (): Promise<TResult> => {
  // @ts-ignore
  return stackPromises().catch((error) => {
    // eslint-disable-next-line no-console
    console.debug('videoSendingBalancer: error', error);
  });
};

const run = (action: () => Promise<TResult>): Promise<TResult> => {
  stackPromises.add(action);

  return runStackPromises();
};

const addToStackScaleResolutionDownBySender = ({
  sender,
  scaleResolutionDownBy,
  maxBitrate,
  onSetParameters,
}: {
  sender: RTCRtpSender;
  scaleResolutionDownBy: number;
  maxBitrate: number;
  onSetParameters?: TOnSetParameters;
}): Promise<TResult> => {
  return run(() => {
    return setEncodingsToSender(sender, { scaleResolutionDownBy, maxBitrate }, onSetParameters);
  });
};

const downgradeResolutionSender = (
  sender: RTCRtpSender,
  onSetParameters?: TOnSetParameters
): Promise<TResult> => {
  const scaleResolutionDownByTarget = 200;
  const maxBitrate = MINIMUM_BITRATE;

  return addToStackScaleResolutionDownBySender({
    sender,
    maxBitrate,
    onSetParameters,
    scaleResolutionDownBy: scaleResolutionDownByTarget,
  });
};

const resetScaleResolutionSender = (
  sender: RTCRtpSender,
  onSetParameters?: TOnSetParameters
): Promise<TResult> => {
  const scaleResolutionDownByTarget = 1;
  const maxBitrate = MAXIMUM_BITRATE;

  return addToStackScaleResolutionDownBySender({
    sender,
    maxBitrate,
    onSetParameters,
    scaleResolutionDownBy: scaleResolutionDownByTarget,
  });
};

const setResolutionSender = (
  sender: RTCRtpSender,
  {
    track,
    resolution,
  }: {
    track: MediaStreamTrack;
    resolution: string;
  },
  onSetParameters?: TOnSetParameters
): Promise<TResult> => {
  const settings = track.getSettings();
  const widthCurrent = settings.width!;
  const heightCurrent = settings.height!;
  const [widthTarget, heightTarget] = resolution.split('x');

  const scaleByWidth = widthCurrent / +widthTarget;
  const scaleByHeight = heightCurrent / +heightTarget!;
  const SCALE_MIN = 1;

  const scaleResolutionDownByTarget = Math.max(scaleByWidth, scaleByHeight, SCALE_MIN);

  const maxBitrate = getMaxBitrateByWidth(+widthTarget);

  return addToStackScaleResolutionDownBySender({
    sender,
    maxBitrate,
    onSetParameters,
    scaleResolutionDownBy: scaleResolutionDownByTarget,
  });
};

const processSender = (
  {
    mainCam,
    resolutionMainCam,
    sender,
    track,
  }: {
    mainCam: EEventsMainCAM;
    resolutionMainCam?: string;
    sender: RTCRtpSender;
    track: MediaStreamTrack;
  },
  onSetParameters?: TOnSetParameters
): Promise<TResult> => {
  switch (mainCam) {
    case EEventsMainCAM.PAUSE_MAIN_CAM:
      return downgradeResolutionSender(sender, onSetParameters);
    case EEventsMainCAM.RESUME_MAIN_CAM:
      return resetScaleResolutionSender(sender, onSetParameters);
    case EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION:
      if (resolutionMainCam) {
        return setResolutionSender(
          sender,
          { track, resolution: resolutionMainCam },
          onSetParameters
        );
      }
  }

  return Promise.resolve({
    isChanged: false,
    parameters: { encodings: [{}], transactionId: '0', codecs: [], headerExtensions: [], rtcp: {} },
  });
};

export default processSender;
