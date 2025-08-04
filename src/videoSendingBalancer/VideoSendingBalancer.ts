import type { EEventsMainCAM } from '../ApiManager';
import { debug } from '../logger';
import type { SipConnector } from '../SipConnector';
import balance from './balance';
import type { TOnSetParameters, TResult } from './setEncodingsToSender';

class VideoSendingBalancer {
  private readonly sipConnector: SipConnector;

  private readonly ignoreForCodec?: string;

  private readonly onSetParameters?: TOnSetParameters;

  private balanceFunction: () => Promise<TResult>;

  public constructor(
    sipConnector: SipConnector,
    options: {
      ignoreForCodec?: string;
      onSetParameters?: TOnSetParameters;
    } = {},
  ) {
    this.sipConnector = sipConnector;
    this.ignoreForCodec = options.ignoreForCodec;
    this.balanceFunction = this.balanceByTrack.bind(this);
    this.onSetParameters = options.onSetParameters;
  }

  public subscribe(): void {
    this.sipConnector.on('api:main-cam-control', this.handleMainCamControl);
  }

  public unsubscribe(): void {
    this.sipConnector.off('api:main-cam-control', this.handleMainCamControl);
    this.resetMainCamControl();
  }

  public resetMainCamControl(): void {
    this.balanceFunction = this.balanceByTrack.bind(this);
  }

  public async reBalance(): Promise<TResult> {
    return this.balanceFunction();
  }

  private async balanceByTrack(): Promise<TResult> {
    const { connection } = this.sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    return balance({
      connection,
      ignoreForCodec: this.ignoreForCodec,
      onSetParameters: this.onSetParameters,
    });
  }

  private readonly handleMainCamControl = (headers: {
    mainCam: EEventsMainCAM;
    resolutionMainCam?: string;
  }) => {
    this.balanceFunction = async () => {
      const { mainCam, resolutionMainCam } = headers;

      const { connection } = this.sipConnector;

      if (!connection) {
        throw new Error('connection is not exist');
      }

      return balance({
        mainCam,
        resolutionMainCam,
        connection,
        ignoreForCodec: this.ignoreForCodec,
        onSetParameters: this.onSetParameters,
      });
    };

    this.balanceFunction().catch(debug);
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
