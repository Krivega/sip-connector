import { ApiManager } from './ApiManager';
import { CallManager } from './CallManager';
import { ConnectionManager } from './ConnectionManager';
import { IncomingCallManager } from './IncomingCallManager';
import { PresentationManager } from './PresentationManager';
import type { TContentHint, TOnAddedTransceiver } from './PresentationManager/types';
import type { TJsSIP } from './types';

class SipConnector {
  private readonly connectionManager: ConnectionManager;

  private readonly callManager: CallManager;

  private readonly apiManager: ApiManager;

  // @ts-expect-error
  private readonly incomingCallManager: IncomingCallManager;

  private readonly presentationManager: PresentationManager;

  public constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.connectionManager = new ConnectionManager({ JsSIP });
    this.callManager = new CallManager();
    this.apiManager = new ApiManager({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
    });
    this.incomingCallManager = new IncomingCallManager(this.connectionManager);
    this.presentationManager = new PresentationManager({
      callManager: this.callManager,
    });
  }

  public async startPresentation(
    stream: MediaStream,
    options: {
      isP2P: boolean;
      isNeedReinvite?: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
      callLimit?: number;
    },
  ): Promise<MediaStream> {
    const { isP2P, callLimit, ...rest } = options;

    if (isP2P) {
      await this.apiManager.sendMustStopPresentationP2P();
      await this.apiManager.askPermissionToStartPresentationP2P();
    } else {
      await this.apiManager.askPermissionToStartPresentation();
    }

    return this.presentationManager.startPresentation(
      stream,
      rest,
      callLimit === undefined ? undefined : { callLimit },
    );
  }

  public async stopPresentation(options: { isP2P: boolean }): Promise<MediaStream | undefined> {
    const { isP2P } = options;

    if (isP2P) {
      await this.apiManager.sendStoppedPresentationP2P();
    } else {
      await this.apiManager.sendStoppedPresentation();
    }

    return this.presentationManager.stopPresentation();
  }

  public async updatePresentation(
    stream: MediaStream,
    options: {
      isP2P: boolean;
      isNeedReinvite?: boolean;
      maxBitrate?: number;
      contentHint?: TContentHint;
      sendEncodings?: RTCRtpEncodingParameters[];
      onAddedTransceiver?: TOnAddedTransceiver;
    },
  ): Promise<MediaStream | undefined> {
    const { isP2P, ...rest } = options;

    if (isP2P) {
      await this.apiManager.sendMustStopPresentationP2P();
      await this.apiManager.askPermissionToStartPresentationP2P();
    } else {
      await this.apiManager.askPermissionToStartPresentation();
    }

    return this.presentationManager.updatePresentation(stream, rest);
  }
}

export default SipConnector;
