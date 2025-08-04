import { EEventsMainCAM } from '@/ApiManager';
import logger, { debug } from '@/logger';
import type { TOnSetParameters, TResult } from '@/setParametersToSender';
import { setEncodingsToSender } from '@/setParametersToSender';
import type { SipConnector } from '@/SipConnector';
import findVideoSender from '@/utils/findVideoSender';
import getCodecFromSender from '@/utils/getCodecFromSender';
import hasIncludesString from '@/utils/hasIncludesString';
import { createStackPromises } from 'stack-promises';
import { calcMaxBitrateByWidthAndCodec, getMaximumBitrate, getMinimumBitrate } from './calcBitrate';
import { calcScaleResolutionDownBy } from './calcResolution';

class VideoSendingBalancer {
  private readonly sipConnector: SipConnector;

  private readonly ignoreForCodec?: string;

  private readonly onSetParameters?: TOnSetParameters;

  private serverHeaders?: {
    mainCam: EEventsMainCAM;
    resolutionMainCam?: string;
  };

  private readonly resultNoChanged: TResult = {
    isChanged: false,
    parameters: {
      encodings: [{}],
      transactionId: '0',
      codecs: [],
      headerExtensions: [],
      rtcp: {},
    },
  };

  private readonly stackPromises = createStackPromises<TResult>();

  public constructor(
    sipConnector: SipConnector,
    options: {
      ignoreForCodec?: string;
      onSetParameters?: TOnSetParameters;
    } = {},
  ) {
    this.sipConnector = sipConnector;
    this.ignoreForCodec = options.ignoreForCodec;
    this.onSetParameters = options.onSetParameters;
  }

  public subscribe(): void {
    this.sipConnector.on('api:main-cam-control', this.handleMainCamControl);
  }

  public unsubscribe(): void {
    this.sipConnector.off('api:main-cam-control', this.handleMainCamControl);
    this.reset();
  }

  public reset(): void {
    delete this.serverHeaders;
  }

  public async reBalance(): Promise<TResult> {
    return this.balanceByTrack();
  }

  private async balanceByTrack(): Promise<TResult> {
    const { connection } = this.sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    return this.balance({
      connection,
      ignoreForCodec: this.ignoreForCodec,
    });
  }

  private async balance({
    connection,
    ignoreForCodec,
  }: {
    connection: RTCPeerConnection;
    ignoreForCodec?: string;
  }): Promise<TResult> {
    const senders = connection.getSenders();
    const sender = findVideoSender(senders);

    if (!sender?.track) {
      return this.resultNoChanged;
    }

    const codec = await getCodecFromSender(sender);

    if (hasIncludesString(codec, ignoreForCodec)) {
      return this.resultNoChanged;
    }

    const { mainCam, resolutionMainCam } = this.serverHeaders ?? {};

    return this.processSender({
      mainCam,
      resolutionMainCam,
      sender,
      codec,
      videoTrack: sender.track as MediaStreamVideoTrack,
    });
  }

  private async runStackPromises(): Promise<TResult> {
    // @ts-expect-error
    return this.stackPromises().catch((error: unknown) => {
      logger('videoSendingBalancer: error', error);
    });
  }

  private async run(action: () => Promise<TResult>): Promise<TResult> {
    this.stackPromises.add(action);

    return this.runStackPromises();
  }

  private async addToStackScaleResolutionDownBySender({
    sender,
    scaleResolutionDownBy,
    maxBitrate,
  }: {
    sender: RTCRtpSender;
    scaleResolutionDownBy: number;
    maxBitrate: number;
  }): Promise<TResult> {
    return this.run(async () => {
      return setEncodingsToSender(
        sender,
        { scaleResolutionDownBy, maxBitrate },
        this.onSetParameters,
      );
    });
  }

  private async downgradeResolutionSender({
    sender,
    codec,
  }: {
    sender: RTCRtpSender;
    codec?: string;
  }): Promise<TResult> {
    const scaleResolutionDownByTarget = 200;
    const maxBitrate = getMinimumBitrate(codec);

    return this.addToStackScaleResolutionDownBySender({
      sender,
      maxBitrate,
      scaleResolutionDownBy: scaleResolutionDownByTarget,
    });
  }

  private async setBitrateByTrackResolution({
    sender,
    videoTrack,
    codec,
  }: {
    sender: RTCRtpSender;
    videoTrack: MediaStreamVideoTrack;
    codec?: string;
  }): Promise<TResult> {
    const scaleResolutionDownByTarget = 1;

    const settings = videoTrack.getSettings();
    const widthCurrent = settings.width;

    const maxBitrate =
      widthCurrent === undefined
        ? getMaximumBitrate(codec)
        : calcMaxBitrateByWidthAndCodec(widthCurrent, codec);

    return this.addToStackScaleResolutionDownBySender({
      sender,
      maxBitrate,
      scaleResolutionDownBy: scaleResolutionDownByTarget,
    });
  }

  private async setResolutionSender({
    sender,
    videoTrack,
    resolution,
    codec,
  }: {
    sender: RTCRtpSender;
    videoTrack: MediaStreamVideoTrack;
    resolution: string;
    codec?: string;
  }): Promise<TResult> {
    const [widthTarget, heightTarget] = resolution.split('x');
    const targetSize = {
      width: Number(widthTarget),
      height: Number(heightTarget),
    };

    const scaleResolutionDownBy = calcScaleResolutionDownBy({
      videoTrack,
      targetSize,
    });
    const maxBitrate = calcMaxBitrateByWidthAndCodec(targetSize.width, codec);

    return this.addToStackScaleResolutionDownBySender({
      sender,
      maxBitrate,
      scaleResolutionDownBy,
    });
  }

  private async processSender({
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
  }): Promise<TResult> {
    switch (mainCam) {
      case EEventsMainCAM.PAUSE_MAIN_CAM: {
        return this.downgradeResolutionSender({ sender, codec });
      }
      case EEventsMainCAM.RESUME_MAIN_CAM: {
        return this.setBitrateByTrackResolution({ sender, videoTrack, codec });
      }
      case EEventsMainCAM.MAX_MAIN_CAM_RESOLUTION: {
        if (resolutionMainCam !== undefined) {
          return this.setResolutionSender({
            sender,
            videoTrack,
            codec,
            resolution: resolutionMainCam,
          });
        }

        return this.setBitrateByTrackResolution({ sender, videoTrack, codec });
      }
      case EEventsMainCAM.ADMIN_STOP_MAIN_CAM:
      case EEventsMainCAM.ADMIN_START_MAIN_CAM:
      case undefined: {
        return this.setBitrateByTrackResolution({ sender, videoTrack, codec });
      }
      default: {
        return this.setBitrateByTrackResolution({ sender, videoTrack, codec });
      }
    }
  }

  private readonly handleMainCamControl = (headers: {
    mainCam: EEventsMainCAM;
    resolutionMainCam?: string;
  }) => {
    this.serverHeaders = headers;

    this.balanceByTrack().catch(debug);
  };
}

// Фабричная функция для обратной совместимости
const resolveVideoSendingBalancer = (
  sipConnector: SipConnector,
  options: {
    ignoreForCodec?: string;
    onSetParameters?: TOnSetParameters;
  } = {},
) => {
  return new VideoSendingBalancer(sipConnector, options);
};

export default VideoSendingBalancer;
export { resolveVideoSendingBalancer };
