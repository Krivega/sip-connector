import { dom } from './dom';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type VideoPlayer from './VideoPlayer';

type TState = 'idle' | 'starting' | 'active' | 'stopping';

class PresentationManager {
  private state: TState = 'idle';

  private presentationStream: MediaStream | undefined = undefined;

  private videoPlayer: VideoPlayer | undefined = undefined;

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

    sipConnectorFacade.on('stopped-presentation-by-server-command', this.reset.bind(this));
    sipConnectorFacade.on('presentation:presentation:failed', this.reset.bind(this));
    sipConnectorFacade.on('presentation:presentation:ended', this.reset.bind(this));
  }

  private unsubscribe(): void {
    sipConnectorFacade.off('stopped-presentation-by-server-command', this.reset.bind(this));
    sipConnectorFacade.off('presentation:presentation:failed', this.reset.bind(this));
    sipConnectorFacade.off('presentation:presentation:ended', this.reset.bind(this));
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
    this.setStarting();

    try {
      this.presentationStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const [videoTrack] = this.presentationStream.getVideoTracks();

      videoTrack.addEventListener('ended', this.reset.bind(this), { once: true });

      this.videoPlayer?.setStream(this.presentationStream);
      this.videoPlayer?.setPlaying(true);

      await sipConnectorFacade.startPresentation({
        mediaStream: this.presentationStream,
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

  private reset(): void {
    this.stopPresentationTracks();
    this.resetPresentationStream();
    this.setIdle();

    this.videoPlayer?.clear();

    dom.startPresentationElement.classList.remove('hidden');
    dom.stopPresentationElement.classList.add('hidden');
    dom.presentationVideoElement.classList.add('hidden');
  }

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
