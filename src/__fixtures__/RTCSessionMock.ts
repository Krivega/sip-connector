/// <reference types="jest" />

import type { IncomingInfoEvent } from '@krivega/jssip';
import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';
import { REJECTED } from '../causes';
import type { TEventHandlers } from './BaseSession.mock';
import BaseSession from './BaseSession.mock';
import RTCPeerConnectionMock from './RTCPeerConnectionMock';
import { getRoomFromSipUrl } from './utils';

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
  url: string;

  status_code?: number;

  private isEndedInner = false;

  private static startPresentationError?: Error;

  private static countStartPresentationError: number = Number.POSITIVE_INFINITY;

  private static countStartsPresentation = 0;

  constructor({
    url = '',
    mediaStream,
    eventHandlers,
    originator,
  }: {
    url?: string;
    mediaStream?: MediaStream;
    eventHandlers: TEventHandlers;
    originator: string;
  }) {
    super({ originator, eventHandlers });
    this.url = url;
    this.initPeerconnection(mediaStream);
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

  public async startPresentation(stream: MediaStream) {
    RTCSessionMock.countStartsPresentation += 1;

    if (
      RTCSessionMock.startPresentationError &&
      RTCSessionMock.countStartsPresentation < RTCSessionMock.countStartPresentationError
    ) {
      throw RTCSessionMock.startPresentationError;
    }

    return super.startPresentation(stream);
  }

  initPeerconnection(mediaStream: MediaStream | undefined) {
    if (!mediaStream) {
      return false;
    }

    this.createPeerconnection(mediaStream);

    return true;
  }

  createPeerconnection(sendedStream: MediaStream) {
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

    this.addStream(sendedStream);

    setTimeout(() => {
      this.trigger('peerconnection', { peerconnection: this.connection });
    }, CONNECTION_DELAY);
  }

  connect(target: string) {
    const room = getRoomFromSipUrl(target);

    setTimeout(() => {
      if (this.url.includes(FAILED_CONFERENCE_NUMBER)) {
        this.trigger('failed', {
          originator: 'remote',
          message: 'IncomingResponse',
          cause: REJECTED,
        });
      } else {
        this.trigger('connecting');

        setTimeout(() => {
          this.trigger('enterRoom', { room });
        }, 100);

        setTimeout(() => {
          this.trigger('accepted');
        }, 200);

        setTimeout(() => {
          this.trigger('confirmed');
        }, 300);
      }
    }, CONNECTION_DELAY);
  }

  /**
     * answer
     *
     * @param {Object} arg1               - The argument 1
     * @param {Object} arg1.mediaStream   - The media stream
     * @param {Array}  arg1.eventHandlers - The event handlers

 * @returns {undefined}
     */
  answer = jest.fn(({ mediaStream }: { mediaStream: MediaStream }) => {
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

  terminate({ status_code, cause }: { status_code?: number; cause?: string } = {}) {
    this.status_code = status_code;

    this.trigger('ended', { status_code, cause, originator: 'local' });

    this.isEndedInner = false;

    return this;
  }

  async terminateAsync({ status_code, cause }: { status_code?: number; cause?: string } = {}) {
    this.terminate({ status_code, cause });
  }

  terminateRemote({ status_code }: { status_code?: number } = {}) {
    this.status_code = status_code;

    this.trigger('ended', { status_code, originator: 'remote' });

    return this;
  }

  addStream(
    stream: MediaStream,
    action: 'getTracks' | 'getAudioTracks' | 'getVideoTracks' = 'getTracks',
  ) {
    stream[action]().forEach((track: MediaStreamTrack) => {
      return this.connection.addTrack(track);
    });
  }

  forEachSenders(callback: (sender: RTCRtpSender) => void) {
    const senders = this.connection.getSenders();

    for (const sender of senders) {
      callback(sender);
    }

    return senders;
  }

  /* eslint-disable no-param-reassign */

  toggleMuteAudio(mute: boolean) {
    this.forEachSenders(({ track }) => {
      if (track && track.kind === 'audio') {
        track.enabled = !mute;
      }
    });
  }
  /* eslint-enable no-param-reassign */

  /* eslint-disable no-param-reassign */

  toggleMuteVideo(mute: boolean) {
    this.forEachSenders(({ track }) => {
      if (track && track.kind === 'video') {
        track.enabled = !mute;
      }
    });
  }

  mute(options: { audio: boolean; video: boolean }) {
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

  unmute(options: { audio: boolean; video: boolean }) {
    if (options.audio) {
      this.mutedOptions.audio = false;
    }

    if (options.video) {
      this.mutedOptions.video = false;
    }

    this.trigger('unmuted', options);
  }

  isMuted() {
    return this.mutedOptions;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function, class-methods-use-this
  async replaceMediaStream(_mediaStream: MediaStream): Promise<void> {}

  onmute({ audio, video }: { audio: boolean; video: boolean }) {
    this.trigger('muted', {
      audio,
      video,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function, class-methods-use-this
  async sendInfo() {}

  isEnded() {
    return this.isEndedInner;
  }

  newInfo(data: IncomingInfoEvent) {
    this.trigger('newInfo', data);
  }
  /* eslint-enable no-param-reassign */
}

export default RTCSessionMock;
