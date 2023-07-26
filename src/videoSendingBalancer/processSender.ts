import createStackPromises from 'stack-promises';
import { EEventsMainCAM } from '../SipConnector';
import getMaxBitrateByWidthAndCodec, {
  getMinimumBitrate,
  getMaximumBitrate,
} from './getMaxBitrateByWidthAndCodec';
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
  { sender, codec }: { sender: RTCRtpSender; codec?: string },
  onSetParameters?: TOnSetParameters,
): Promise<TResult> => {
  const scaleResolutionDownByTarget = 200;
  const maxBitrate = getMinimumBitrate(codec);

  return addToStackScaleResolutionDownBySender({
    sender,
    maxBitrate,
    onSetParameters,
    scaleResolutionDownBy: scaleResolutionDownByTarget,
  });
};

const resetScaleResolutionSender = (
  { sender, codec }: { sender: RTCRtpSender; codec?: string },
  onSetParameters?: TOnSetParameters,
): Promise<TResult> => {
  const scaleResolutionDownByTarget = 1;
  const maxBitrate = getMaximumBitrate(codec);

  return addToStackScaleResolutionDownBySender({
    sender,
    maxBitrate,
    onSetParameters,
    scaleResolutionDownBy: scaleResolutionDownByTarget,
  });
};

const setResolutionSender = (
  {
    sender,
    track,
    resolution,
    codec,
  }: {
    sender: RTCRtpSender;
    track: MediaStreamTrack;
    resolution: string;
    codec?: string;
  },
  onSetParameters?: TOnSetParameters,
): Promise<TResult> => {
  const settings = track.getSettings();
  const widthCurrent = settings.width!;
  const heightCurrent = settings.height!;
  const [widthTarget, heightTarget] = resolution.split('x');

  const scaleByWidth = widthCurrent / +widthTarget;
  const scaleByHeight = heightCurrent / +heightTarget!;
  const SCALE_MIN = 1;

  const scaleResolutionDownByTarget = Math.max(scaleByWidth, scaleByHeight, SCALE_MIN);

  const maxBitrate = getMaxBitrateByWidthAndCodec(+widthTarget, codec);

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
    codec,
  }: {
    mainCam: EEventsMainCAM;
    resolutionMainCam?: string;
    sender: RTCRtpSender;
    track: MediaStreamTrack;
    codec?: string;
  },
  onSetParameters?: TOnSetParameters,
): Promise<TResult> => {
  switch (mainCam) {
    case EEventsMainCAM.PAUSE_MAIN_CAM:
      return downgradeResolutionSender({ sender, codec }, onSetParameters);
    case EEventsMainCAM.RESUME_MAIN_CAM:
      return resetScaleResolutionSender({ sender, codec }, onSetParameters);
    case EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION:
      if (resolutionMainCam) {
        return setResolutionSender(
          { sender, track, codec, resolution: resolutionMainCam },
          onSetParameters,
        );
      }
  }

  return Promise.resolve({
    isChanged: false,
    parameters: { encodings: [{}], transactionId: '0', codecs: [], headerExtensions: [], rtcp: {} },
  });
};

export default processSender;
