import { createStackPromises } from 'stack-promises';
import logger from '../logger';
import { EEventsMainCAM } from '../types';
import getMaxBitrateByWidthAndCodec, { getMinimumBitrate } from './getMaxBitrateByWidthAndCodec';
import scaleResolutionAndBitrate from './scaleResolutionAndBitrate';
import type { TOnSetParameters, TResult } from './setEncodingsToSender';
import setEncodingsToSender from './setEncodingsToSender';

const stackPromises = createStackPromises<TResult>();

const runStackPromises = async (): Promise<TResult> => {
  // @ts-expect-error
  return stackPromises().catch((error: unknown) => {
    logger('videoSendingBalancer: error', error);
  });
};

const run = async (action: () => Promise<TResult>): Promise<TResult> => {
  stackPromises.add(action);

  return runStackPromises();
};

const addToStackScaleResolutionDownBySender = async ({
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
  return run(async () => {
    return setEncodingsToSender(sender, { scaleResolutionDownBy, maxBitrate }, onSetParameters);
  });
};

const downgradeResolutionSender = async (
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

const setBitrateByTrackResolution = async (
  {
    sender,
    videoTrack,
    codec,
  }: { sender: RTCRtpSender; videoTrack: MediaStreamVideoTrack; codec?: string },
  onSetParameters?: TOnSetParameters,
): Promise<TResult> => {
  const scaleResolutionDownByTarget = 1;

  const settings = videoTrack.getSettings();
  const widthCurrent = settings.width;

  const maxBitrate = getMaxBitrateByWidthAndCodec(widthCurrent ?? 0, codec);

  return addToStackScaleResolutionDownBySender({
    sender,
    maxBitrate,
    onSetParameters,
    scaleResolutionDownBy: scaleResolutionDownByTarget,
  });
};

const setResolutionSender = async (
  {
    sender,
    videoTrack,
    resolution,
    codec,
  }: {
    sender: RTCRtpSender;
    videoTrack: MediaStreamVideoTrack;
    resolution: string;
    codec?: string;
  },
  onSetParameters?: TOnSetParameters,
): Promise<TResult> => {
  const [widthTarget, heightTarget] = resolution.split('x');
  const { maxBitrate, scaleResolutionDownBy } = scaleResolutionAndBitrate({
    videoTrack,
    codec,
    targetSize: {
      width: Number(widthTarget),
      height: Number(heightTarget),
    },
  });

  return addToStackScaleResolutionDownBySender({
    sender,
    maxBitrate,
    onSetParameters,
    scaleResolutionDownBy,
  });
};

const processSender = async (
  {
    mainCam,
    resolutionMainCam,
    sender,
    videoTrack,
    codec,
  }: {
    mainCam?: EEventsMainCAM;
    resolutionMainCam?: string;
    sender: RTCRtpSender;
    videoTrack: MediaStreamVideoTrack;
    codec?: string;
  },
  onSetParameters?: TOnSetParameters,
): Promise<TResult> => {
  switch (mainCam) {
    case EEventsMainCAM.PAUSE_MAIN_CAM: {
      return downgradeResolutionSender({ sender, codec }, onSetParameters);
    }
    case EEventsMainCAM.RESUME_MAIN_CAM: {
      return setBitrateByTrackResolution({ sender, videoTrack, codec }, onSetParameters);
    }
    case EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION: {
      if (resolutionMainCam !== undefined) {
        return setResolutionSender(
          { sender, videoTrack, codec, resolution: resolutionMainCam },
          onSetParameters,
        );
      }

      return setBitrateByTrackResolution({ sender, videoTrack, codec }, onSetParameters);
    }
    case EEventsMainCAM.ADMIN_STOP_MAIN_CAM:
    case EEventsMainCAM.ADMIN_START_MAIN_CAM:
    case undefined: {
      return setBitrateByTrackResolution({ sender, videoTrack, codec }, onSetParameters);
    }
    default: {
      return setBitrateByTrackResolution({ sender, videoTrack, codec }, onSetParameters);
    }
  }
};

export default processSender;
