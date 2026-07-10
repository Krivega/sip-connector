import { setEncodingsToSender } from '@/tools/setParametersToSender';
import RTCSessionMock from './RTCSessionMock';

import type { TEventHandlers } from './BaseSession.mock';

type TStartPresentationOptions = {
  sendEncodings?: RTCRtpEncodingParameters[];
};

const applyPresentationSendEncodingsToSender = async (
  sender: RTCRtpSender,
  sendEncodings?: RTCRtpEncodingParameters[],
) => {
  const encoding = sendEncodings?.[0];

  if (encoding === undefined) {
    return;
  }

  if (encoding.scaleResolutionDownBy === undefined && encoding.maxBitrate === undefined) {
    return;
  }

  await setEncodingsToSender(sender, {
    scaleResolutionDownBy: encoding.scaleResolutionDownBy,
    maxBitrate: encoding.maxBitrate,
  });
};

/**
 * RTCSessionMock с симуляцией переиспользования presentation-sender между stop/start:
 * sendEncodings применяются только при первом addTrack (как addTransceiver в jssip).
 */
class PresentationSessionMock extends RTCSessionMock {
  private presentationSender?: RTCRtpSender;

  public constructor(parameters: {
    eventHandlers: TEventHandlers;
    originator: string;
    remoteIdentity?: ConstructorParameters<typeof RTCSessionMock>[0]['remoteIdentity'];
    delayStartPresentation?: number;
  }) {
    super(parameters);

    const originalStartPresentation = this.startPresentation.bind(this);
    const originalStopPresentation = this.stopPresentation.bind(this);

    this.startPresentation = async (
      stream: MediaStream,
      _isNeedReinvite?: boolean,
      options?: TStartPresentationOptions,
    ) => {
      await this.attachPresentationStream(stream, options?.sendEncodings);

      return originalStartPresentation(stream);
    };

    this.stopPresentation = async (stream: MediaStream) => {
      if (this.presentationSender !== undefined) {
        // WebRTC API: replaceTrack(null) снимает track с sender
        // eslint-disable-next-line unicorn/no-null
        await this.presentationSender.replaceTrack(null);
      }

      return originalStopPresentation(stream);
    };
  }

  private async attachPresentationStream(
    stream: MediaStream,
    sendEncodings?: RTCRtpEncodingParameters[],
  ) {
    const videoTracks = stream.getVideoTracks();

    if (videoTracks.length === 0) {
      return;
    }

    const videoTrack = videoTracks[0];

    if (this.presentationSender === undefined) {
      this.presentationSender = this.connection.addTrack(videoTrack, stream);
      await applyPresentationSendEncodingsToSender(this.presentationSender, sendEncodings);

      return;
    }

    await this.presentationSender.replaceTrack(videoTrack);
  }
}

export default PresentationSessionMock;
