import { dom } from './dom';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type VideoPlayer from './VideoPlayer';

type TState = 'idle' | 'starting' | 'active' | 'stopping';

class PresentationManager {
  private state: TState = 'idle';

  private presentationStream: MediaStream | undefined = undefined;

  private videoPlayer: VideoPlayer | undefined = undefined;

  private unsubscribeEndedVideoTrack: (() => void) | undefined = undefined;

  private unsubscribeSipConnectorEvents: (() => void) | undefined = undefined;

  public constructor() {
    dom.startPresentationElement.addEventListener('click', this.handleStart.bind(this));
    dom.stopPresentationElement.addEventListener('click', this.handleStop.bind(this));
  }

  private get isNotIdle() {
    return !this.isIdle;
  }

  private get isIdle() {
    return this.state === 'idle';
  }

  private get isNotActive() {
    return !this.isActive;
  }

  private get isActive() {
    return this.state === 'active';
  }

  public activate(): void {
    this.subscribe();

    dom.startPresentationElement.classList.remove('hidden');
  }

  public deactivate(): void {
    this.unsubscribe();
    this.reset();

    dom.startPresentationElement.classList.add('hidden');
  }

  public setVideoPlayer(videoPlayer: VideoPlayer): void {
    this.videoPlayer = videoPlayer;
  }

  private subscribe(): void {
    this.unsubscribe();

    const offStoppedByServerCommand = sipConnectorFacade.on(
      'stopped-presentation-by-server-command',
      this.reset,
    );
    const offPresentationFailed = sipConnectorFacade.on(
      'presentation:presentation:failed',
      this.reset,
    );
    const offPresentationEnded = sipConnectorFacade.on(
      'presentation:presentation:ended',
      this.reset,
    );

    this.unsubscribeSipConnectorEvents = () => {
      offStoppedByServerCommand();
      offPresentationFailed();
      offPresentationEnded();
    };
  }

  private unsubscribe(): void {
    this.unsubscribeSipConnectorEvents?.();
  }

  private readonly handleStop = () => {
    if (this.isNotActive) {
      return;
    }

    this.stop().catch((error: unknown) => {
      console.log('failed to stop presentation', error);
    });
  };

  private readonly handleStart = () => {
    if (this.isNotIdle) {
      return;
    }

    this.start().catch((error: unknown) => {
      console.log('failed to start presentation', error);
    });
  };

  private async start(): Promise<void> {
    const presentationStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    await this.startByMediaStream(presentationStream);
  }

  private async startByMediaStream(mediaStream: MediaStream): Promise<void> {
    this.setStarting();

    try {
      this.presentationStream = mediaStream;

      this.subscribeEndedVideoTrack(mediaStream);

      this.videoPlayer?.setStream(mediaStream);
      this.videoPlayer?.setPlaying(true);

      await sipConnectorFacade.startPresentation({
        mediaStream,
        isP2P: false,
      });

      dom.startPresentationElement.classList.add('hidden');
      dom.stopPresentationElement.classList.remove('hidden');
      dom.presentationVideoElement.classList.remove('hidden');

      this.setActive();
    } catch (error: unknown) {
      this.reset();

      throw error;
    }
  }

  private subscribeEndedVideoTrack(mediaStream: MediaStream) {
    this.unsubscribeEndedVideoTrack?.();

    const [videoTrack] = mediaStream.getVideoTracks();

    videoTrack.addEventListener('ended', this.reset, { once: true });

    this.unsubscribeEndedVideoTrack = () => {
      videoTrack.removeEventListener('ended', this.reset);
    };
  }

  private readonly reset = () => {
    this.unsubscribeEndedVideoTrack?.();
    this.stopPresentationTracks();
    this.resetPresentationStream();
    this.setIdle();

    this.videoPlayer?.clear();

    dom.startPresentationElement.classList.remove('hidden');
    dom.stopPresentationElement.classList.add('hidden');
    dom.presentationVideoElement.classList.add('hidden');
  };

  private resetPresentationStream() {
    this.setPresentationStream(undefined);
  }

  private setPresentationStream(presentationStream: MediaStream | undefined) {
    this.presentationStream = presentationStream;
  }

  private stopPresentationTracks() {
    this.presentationStream?.getTracks().forEach((track) => {
      track.stop();
    });
  }

  private async stop(): Promise<void> {
    if (this.isNotActive) {
      return;
    }

    this.setStopping();

    try {
      await sipConnectorFacade.stopShareSipConnector({ isP2P: false });
    } finally {
      this.reset();
    }
  }

  private setIdle() {
    this.state = 'idle';
  }

  private setStarting() {
    this.state = 'starting';
  }

  private setActive() {
    this.state = 'active';
  }

  private setStopping() {
    this.state = 'stopping';
  }
}

export default PresentationManager;
