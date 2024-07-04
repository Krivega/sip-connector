/// <reference types="jest" />

import type { IncomingInfoEvent } from '@krivega/jssip';
import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';
import { REJECTED } from '../causes';
import BaseSession from './BaseSession.mock';
import RTCPeerConnectionMock from './RTCPeerConnectionMock';
import { getRoomFromSipUrl } from './utils';

const CONNECTION_DELAY = 400; // more 300 for test cancel requests with debounced

export const FAILED_CONFERENCE_NUMBER = '777';

const hasVideoTracks = (mediaStream: MediaStream): boolean => {
  return mediaStream.getVideoTracks().length > 0;
};

class Session extends BaseSession {
  url: string;

  status_code?: number;

  private _isEnded = false;

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
    mediaStream?: any;
    eventHandlers?: any;
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
    Session.countStartsPresentation += 1;

    if (
      Session.startPresentationError &&
      Session.countStartsPresentation < Session.countStartPresentationError
    ) {
      throw Session.startPresentationError;
    }

    return super.startPresentation(stream);
  }

  initPeerconnection(mediaStream: any) {
    if (!mediaStream) {
      return false;
    }

    this.createPeerconnection(mediaStream);

    return true;
  }

  createPeerconnection(sendedStream: any) {
    const audioTrack = createAudioMediaStreamTrackMock();

    audioTrack.id = 'mainaudio1';

    const tracks = [audioTrack];

    const isVideoStream = hasVideoTracks(sendedStream);

    if (isVideoStream) {
      const videoTrack = createVideoMediaStreamTrackMock();

      videoTrack.id = 'mainvideo1';

      tracks.push(videoTrack);
    }

    this._connection = new RTCPeerConnectionMock(undefined, tracks);

    this._addStream(sendedStream);

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
  answer = jest.fn(({ mediaStream }) => {
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

  terminate({ status_code }: { status_code?: number } = {}) {
    this.status_code = status_code;

    this.trigger('ended', { status_code });

    this._isEnded = false;

    return this;
  }

  async terminateAsync({ status_code }: { status_code?: number } = {}) {
    this.terminate({ status_code });
  }

  terminateRemote({ status_code }: { status_code?: number } = {}) {
    this.status_code = status_code;

    this.trigger('ended', { status_code, originator: 'remote' });

    return this;
  }

  _addStream(stream: Record<string, () => any[]>, action = 'getTracks') {
    stream[action]().forEach((track: MediaStreamTrack) => {
      return this.connection.addTrack(track);
    });
  }

  _forEachSenders(callback: {
    ({ track }: { track: any }): void;
    ({ track }: { track: any }): void;
    (argument0: any): void;
  }) {
    const senders = this.connection.getSenders();

    for (const sender of senders) {
      callback(sender);
    }

    return senders;
  }

  /* eslint-disable no-param-reassign */

  _toggleMuteAudio(mute: boolean) {
    this._forEachSenders(({ track }) => {
      if (track && track.kind === 'audio') {
        track.enabled = !mute;
      }
    });
  }
  /* eslint-enable no-param-reassign */

  /* eslint-disable no-param-reassign */

  _toggleMuteVideo(mute: boolean) {
    this._forEachSenders(({ track }) => {
      if (track && track.kind === 'video') {
        track.enabled = !mute;
      }
    });
  }

  mute(options: { audio: any; video: any }) {
    if (options.audio) {
      this._mutedOptions.audio = true;
      this._toggleMuteAudio(this._mutedOptions.audio);
    }

    if (options.video) {
      this._mutedOptions.video = true;
      this._toggleMuteVideo(this._mutedOptions.video);
    }

    this._onmute(options);
  }

  unmute(options: { audio: any; video: any }) {
    if (options.audio) {
      this._mutedOptions.audio = false;
    }

    if (options.video) {
      this._mutedOptions.video = false;
    }

    this.trigger('unmuted', options);
  }

  isMuted() {
    return this._mutedOptions;
  }

  async replaceMediaStream(mediaStream: any) {
    return mediaStream;
  }

  _onmute({ audio, video }: { audio: boolean; video: boolean }) {
    this.trigger('muted', {
      audio,
      video,
    });
  }

  async sendInfo() {}

  isEnded() {
    return this._isEnded;
  }

  newInfo(data: IncomingInfoEvent) {
    this.trigger('newInfo', data);
  }
  /* eslint-enable no-param-reassign */
}

export default Session;
