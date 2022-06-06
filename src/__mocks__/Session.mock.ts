import { createAudioMediaStreamTrackMock, createVideoMediaStreamTrackMock } from 'webrtc-mock';
import { REJECTED } from '../causes';
import type { IncomingInfoEvent } from '@krivega/jssip/lib/RTCSession';
import { getRoomFromSipUrl } from './utils';
import RTCPeerConnectionMock from './RTCPeerConnectionMock';
import BaseSession from './BaseSession.mock';

const CONNECTION_DELAY = 400; // more 300 for test cancel requests with debounced
const TIMEOUT_ENTER_ROOM = CONNECTION_DELAY + 100;
const TIMEOUT_ACCEPTED = TIMEOUT_ENTER_ROOM + 200;
const TIMEOUT_CONFIRMED = TIMEOUT_ENTER_ROOM + 300;

export const FAILED_CONFERENCE_NUMBER = '777';

const hasVideoTracks = (mediaStream: MediaStream): boolean => {
  return !!mediaStream.getVideoTracks().length;
};

/* eslint-disable class-methods-use-this */

class Session extends BaseSession {
  url: string;

  status_code?: number;

  private _isEnded = false;

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

    this._connection = new RTCPeerConnectionMock(tracks);

    this._addStream(sendedStream);

    setTimeout(() => {
      this.trigger('peerconnection', { peerconnection: this.connection });
    }, CONNECTION_DELAY);
  }

  connect(target) {
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
          this.trigger('enterRoom', room);
        }, TIMEOUT_ENTER_ROOM);

        setTimeout(() => {
          this.trigger('accepted');
        }, TIMEOUT_ACCEPTED);

        setTimeout(() => {
          this.trigger('confirmed');
        }, TIMEOUT_CONFIRMED);
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
  answer({ mediaStream, eventHandlers }) {
    if (this.originator !== 'remote') {
      const error = new Error('answer available only for remote sessions');

      throw error;
    }

    setTimeout(() => {
      this.trigger('confirmed');
    }, TIMEOUT_CONFIRMED);

    this.initEvents(eventHandlers);
    this.initPeerconnection(mediaStream);
  }

  // eslint-disable-next-line camelcase
  terminate({ status_code }: { status_code?: number } = {}) {
    // eslint-disable-next-line camelcase
    this.status_code = status_code;

    this.trigger('ended', { status_code });

    this._isEnded = false;

    return this;
  }

  // eslint-disable-next-line camelcase
  terminateRemote({ status_code }: { status_code?: number } = {}) {
    // eslint-disable-next-line camelcase
    this.status_code = status_code;

    this.trigger('ended', { status_code, originator: 'remote' });

    return this;
  }

  _addStream(stream: { [x: string]: () => any[] }, action = 'getTracks') {
    stream[action]().forEach((track: MediaStreamTrack) => {
      return this.connection!.addTrack(track);
    });
  }

  _forEachSenders(callback: {
    ({ track }: { track: any }): void;
    ({ track }: { track: any }): void;
    (arg0: any): void;
  }) {
    const senders = this.connection!.getSenders();

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

  replaceMediaStream(mediaStream: any) {
    return Promise.resolve(mediaStream);
  }

  _onmute({ audio, video }: { audio: boolean; video: boolean }) {
    this.trigger('muted', {
      audio,
      video,
    });
  }

  sendInfo() {
    return Promise.resolve();
  }

  isEnded() {
    return this._isEnded;
  }

  newInfo(data: IncomingInfoEvent) {
    this.trigger('newInfo', data);
  }
  /* eslint-enable no-param-reassign */
}

export default Session;
