/// <reference types="jest" />

import { NameAddrHeader, URI, SessionStatus } from '@krivega/jssip';
import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';

import BaseSession from './BaseSession.mock';
import RTCPeerConnectionMock from './RTCPeerConnectionMock';
import { getRoomFromSipUrl } from './utils';
import { Originator } from '../CallManager/events';

import type { IncomingInfoEvent } from '@krivega/jssip';
import type { TEventHandlers } from './BaseSession.mock';

const CONNECTION_DELAY = 400; // more 300 for test cancel requests with debounced

export const FAILED_CONFERENCE_NUMBER = '777';

const DECLINE = 603;

export const createDeclineStartPresentationError = () => {
  const error = new Error('Failed to start presentation');

  error.cause = DECLINE;

  return error;
};

const hasVideoTracks = (mediaStream: MediaStream): boolean => {
  return mediaStream.getVideoTracks().length > 0;
};

class RTCSessionMock extends BaseSession {
  private static presentationError?: Error;

  private static startPresentationError?: Error;

  private static countStartPresentationError: number = Number.POSITIVE_INFINITY;

  private static countStartsPresentation = 0;

  public url?: string;

  public status_code?: number;

  /**
     * answer
     *
     * @param {Object} arg1               - The argument 1
     * @param {Object} arg1.mediaStream   - The media stream
     * @param {Array}  arg1.eventHandlers - The event handlers

 * @returns {undefined}
     */
  public answer = jest.fn(({ mediaStream }: { mediaStream: MediaStream }) => {
    if (this.originator !== 'remote') {
      const error = new Error('answer available only for remote sessions');

      throw error;
    }

    this.initPeerconnection(mediaStream);

    setTimeout(() => {
      this.trigger('connecting');

      setTimeout(() => {
        this.trigger('accepted');
      }, 100);

      setTimeout(() => {
        this.trigger('confirmed');
      }, 200);
    }, CONNECTION_DELAY);
  });

  public replaceMediaStream = jest.fn(async (_mediaStream: MediaStream): Promise<void> => {});

  public _isReadyToReOffer = jest.fn((): boolean => {
    return true;
  });

  public addTransceiver = jest.fn(
    (_trackOrKind: MediaStreamTrack | string, _init?: RTCRtpTransceiverInit): RTCRtpTransceiver => {
      return {} as RTCRtpTransceiver;
    },
  );

  public restartIce = jest.fn(
    async (_options?: {
      useUpdate?: boolean;
      extraHeaders?: string[];
      rtcOfferConstraints?: RTCOfferOptions;
      sendEncodings?: RTCRtpEncodingParameters[];
      degradationPreference?: RTCDegradationPreference;
    }): Promise<boolean> => {
      // Имитация успешного перезапуска ICE
      return true;
    },
  );

  private isEndedInner = false;

  private readonly delayStartPresentation: number = 0;

  private timeoutStartPresentation?: NodeJS.Timeout;

  private timeoutConnect?: NodeJS.Timeout;

  private timeoutNewInfo?: NodeJS.Timeout;

  private timeoutAccepted?: NodeJS.Timeout;

  private timeoutConfirmed?: NodeJS.Timeout;

  public constructor({
    eventHandlers,
    originator,
    remoteIdentity = new NameAddrHeader(
      new URI('sip', 'caller1', 'test1.com', 5060),
      'Test Caller 1',
    ),
    delayStartPresentation = 0,
  }: {
    eventHandlers: TEventHandlers;
    originator: string;
    remoteIdentity?: NameAddrHeader;
    delayStartPresentation?: number;
  }) {
    super({ originator, eventHandlers, remoteIdentity });

    this.delayStartPresentation = delayStartPresentation;
  }

  public static get C(): typeof SessionStatus {
    return SessionStatus;
  }

  public static setPresentationError(presentationError: Error) {
    this.presentationError = presentationError;
  }

  public static resetPresentationError() {
    this.presentationError = undefined;
  }

  public static setStartPresentationError(
    startPresentationError: Error,
    { count = Number.POSITIVE_INFINITY }: { count?: number } = {},
  ) {
    this.startPresentationError = startPresentationError;
    this.countStartPresentationError = count;
  }

  public static resetStartPresentationError() {
    this.startPresentationError = undefined;
    this.countStartPresentationError = Number.POSITIVE_INFINITY;
    this.countStartsPresentation = 0;
  }

  public startPresentation = async (stream: MediaStream) => {
    RTCSessionMock.countStartsPresentation += 1;

    return new Promise<MediaStream>((resolve, reject) => {
      this.timeoutStartPresentation = setTimeout(() => {
        if (RTCSessionMock.presentationError) {
          this.trigger('presentation:start', stream);

          this.trigger('presentation:failed', stream);

          reject(RTCSessionMock.presentationError);

          return;
        }

        if (
          RTCSessionMock.startPresentationError &&
          RTCSessionMock.countStartsPresentation < RTCSessionMock.countStartPresentationError
        ) {
          this.trigger('presentation:start', stream);

          this.trigger('presentation:failed', stream);

          reject(RTCSessionMock.startPresentationError);

          return;
        }

        resolve(super.startPresentation(stream));
      }, this.delayStartPresentation);
    });
  };

  public stopPresentation = async (stream: MediaStream) => {
    if (RTCSessionMock.presentationError) {
      this.trigger('presentation:end', stream);

      this.trigger('presentation:failed', stream);

      throw RTCSessionMock.presentationError;
    }

    return super.stopPresentation(stream);
  };

  public initPeerconnection(mediaStream: MediaStream | undefined) {
    if (!mediaStream) {
      return false;
    }

    this.createPeerconnection(mediaStream);

    return true;
  }

  public createPeerconnection(sendedStream: MediaStream) {
    const audioTrack = createAudioMediaStreamTrackMock();

    audioTrack.id = 'mainaudio1';

    const tracks = [audioTrack];

    const isVideoStream = hasVideoTracks(sendedStream);

    if (isVideoStream) {
      const videoTrack = createVideoMediaStreamTrackMock();

      videoTrack.id = 'mainvideo1';

      tracks.push(videoTrack);
    }

    this.connection = new RTCPeerConnectionMock(undefined, tracks);
    this.trigger('peerconnection', { peerconnection: this.connection });

    this.addStream(sendedStream);
  }

  public connect(target: string, { mediaStream }: { mediaStream?: MediaStream } = {}) {
    const room = getRoomFromSipUrl(target);

    this.initPeerconnection(mediaStream);

    this.timeoutConnect = setTimeout(() => {
      if (target.includes(FAILED_CONFERENCE_NUMBER)) {
        this.trigger('failed', {
          originator: 'remote',
          message: 'IncomingResponse',
          cause: 'Rejected',
        });
      } else {
        this.trigger('connecting');

        this.timeoutNewInfo = setTimeout(() => {
          this.newInfo({
            originator: Originator.REMOTE,
            // @ts-expect-error
            request: {
              getHeader: (name: string) => {
                if (name === 'content-type') {
                  return 'application/vinteo.webrtc.roomname';
                }

                if (name === 'x-webrtc-enter-room') {
                  return room;
                }

                if (name === 'x-webrtc-participant-name') {
                  return 'Test Caller 1';
                }

                return '';
              },
            },
          });
        }, 100);

        this.timeoutAccepted = setTimeout(() => {
          this.trigger('accepted');
        }, 200);

        this.timeoutConfirmed = setTimeout(() => {
          this.trigger('confirmed');
        }, 300);
      }
    }, CONNECTION_DELAY);

    return this.connection;
  }

  public terminate({ status_code, cause }: { status_code?: number; cause?: string } = {}) {
    this.status_code = status_code;

    this.trigger('ended', { status_code, cause, originator: 'local' });

    this.isEndedInner = false;

    return this;
  }

  public async terminateAsync({
    status_code,
    cause,
  }: { status_code?: number; cause?: string } = {}) {
    this.terminate({ status_code, cause });
  }

  public terminateRemote({ status_code }: { status_code?: number } = {}) {
    this.status_code = status_code;

    this.trigger('ended', { status_code, originator: 'remote' });

    return this;
  }

  public addStream(
    stream: MediaStream,
    action: 'getTracks' | 'getAudioTracks' | 'getVideoTracks' = 'getTracks',
  ) {
    stream[action]().forEach((track: MediaStreamTrack) => {
      return this.connection.addTrack(track, stream);
    });
  }

  public forEachSenders(callback: (sender: RTCRtpSender) => void) {
    const senders = this.connection.getSenders();

    for (const sender of senders) {
      callback(sender);
    }

    return senders;
  }

  public toggleMuteAudio(mute: boolean) {
    this.forEachSenders(({ track }) => {
      if (track?.kind === 'audio') {
        // eslint-disable-next-line no-param-reassign
        track.enabled = !mute;
      }
    });
  }

  public toggleMuteVideo(mute: boolean) {
    this.forEachSenders(({ track }) => {
      if (track?.kind === 'video') {
        // eslint-disable-next-line no-param-reassign
        track.enabled = !mute;
      }
    });
  }

  public mute(options: { audio: boolean; video: boolean }) {
    if (options.audio) {
      this.mutedOptions.audio = true;
      this.toggleMuteAudio(this.mutedOptions.audio);
    }

    if (options.video) {
      this.mutedOptions.video = true;
      this.toggleMuteVideo(this.mutedOptions.video);
    }

    this.onmute(options);
  }

  public unmute(options: { audio: boolean; video: boolean }) {
    if (options.audio) {
      this.mutedOptions.audio = false;
    }

    if (options.video) {
      this.mutedOptions.video = false;
    }

    this.trigger('unmuted', options);
  }

  public isMuted() {
    return this.mutedOptions;
  }

  public onmute({ audio, video }: { audio: boolean; video: boolean }) {
    this.trigger('muted', {
      audio,
      video,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/class-methods-use-this
  public async sendInfo() {}

  public isEnded() {
    return this.isEndedInner;
  }

  public newInfo(data: IncomingInfoEvent) {
    this.trigger('newInfo', data);
  }

  public clear() {
    clearTimeout(this.timeoutStartPresentation);
    clearTimeout(this.timeoutConnect);
    clearTimeout(this.timeoutNewInfo);
    clearTimeout(this.timeoutAccepted);
    clearTimeout(this.timeoutConfirmed);
  }
}

export default RTCSessionMock;
