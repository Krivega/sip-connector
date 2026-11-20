import type { TOnAddedTransceiver } from '@/CallManager';
import type { TConnectAndCallSessionResult } from '@/ConnectAndCallSession';
import type { TConnectionConfig, TParametersConnection } from '@/ConnectionManager';
import type { TContentHint } from '@/utils/peerConnection';

export type TConnectToServerParameters =
  TParametersConnection | (() => Promise<TParametersConnection>);

export type TConnectToServerOptions = {
  hasReadyForConnection?: () => boolean;
};

export type TConnectToServerResult =
  | {
      configuration: TConnectionConfig;
      isSuccessful: true;
    }
  | {
      configuration: undefined;
      isSuccessful: false;
    };

export type TCallToServerParameters = {
  conference: string;
  mediaStream: MediaStream;
  extraHeaders?: string[];
  iceServers?: RTCIceServer[];
  contentHint?: TContentHint;
  degradationPreference?: RTCDegradationPreference;
  sendEncodings?: RTCRtpEncodingParameters[];
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
  directionVideo?: RTCRtpTransceiverDirection;
  directionAudio?: RTCRtpTransceiverDirection;
  onBeforeProgressCall?: (conference: string) => void;
  onSuccessProgressCall?: (parameters: { isPurgatory: boolean }) => void;
  onEnterPurgatory?: () => void;
  onEnterConference?: (parameters: { isSuccessProgressCall: boolean }) => void;
  onFailProgressCall?: () => void;
  onFinishProgressCall?: () => void;
  onEndedCall?: () => void;
  onAddedTransceiver?: TOnAddedTransceiver;
  /**
   * Включает автоматический перезвон при сетевых обрывах звонка.
   * По умолчанию `true`.
   */
  autoRedial?: boolean;
};

export type TConnectAndCallToServerParameters = {
  connection: {
    parameters: TConnectToServerParameters;
    options?: TConnectToServerOptions;
  };
  call: TCallToServerParameters;
};

export type TConnectAndCallToServerResult = TConnectAndCallSessionResult;
