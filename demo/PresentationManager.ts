import { dom } from './dom';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type VideoPlayer from './VideoPlayer';

type TState = 'idle' | 'ready' | 'starting' | 'started' | 'stopping';
type TStressTestingState = 'started' | 'stopped';

class PresentationManager {
  private state: TState = 'idle';

  private stressTestingState: TStressTestingState = 'stopped';

  private presentationStream: MediaStream | undefined = undefined;

  private videoPlayer: VideoPlayer | undefined = undefined;

  private unsubscribeEndedVideoTrack: (() => void) | undefined = undefined;

  private unsubscribeSipConnectorEvents: (() => void) | undefined = undefined;

  public constructor() {
    dom.startPresentationElement.addEventListener('click', this.handleStart);
    dom.startStressTestingPresentationElement.addEventListener(
      'click',
      this.handleStartStressTesting,
    );
    dom.stopPresentationElement.addEventListener('click', this.handleStop);
  }

  private get isNotStartedStressTesting() {
    return !this.isStartedStressTesting;
  }

  private get isStartedStressTesting() {
    return this.stressTestingState === 'started';
  }

  private get isNotReady() {
    return !this.isReady;
  }

  private get isReady() {
    return this.state === 'ready';
  }

  private get isNotStarted() {
    return !this.isStarted;
  }

  private get isStarted() {
    return this.state === 'started';
  }

  public activate(): void {
    this.setReady();
    this.updateUi();
  }

  public deactivate(): void {
    this.resetPresentation({ isStopPresentationTracks: true });
    this.setStoppedStressTesting();
    this.setIdle();
    this.updateUi();
  }

  public setVideoPlayer(videoPlayer: VideoPlayer): void {
    this.videoPlayer = videoPlayer;
  }

  private subscribeSipConnectorEvents({
    isStopPresentationTracks,
  }: {
    isStopPresentationTracks: boolean;
  }): void {
    this.unsubscribeSipConnectorEvents?.();

    const handleStoppedPresentation = () => {
      this.resetPresentation({ isStopPresentationTracks });
    };

    const offStoppedByServerCommand = sipConnectorFacade.on(
      'stopped-presentation-by-server-command',
      handleStoppedPresentation,
    );
    const offPresentationFailed = sipConnectorFacade.on(
      'presentation:presentation:failed',
      handleStoppedPresentation,
    );
    const offPresentationEnded = sipConnectorFacade.on(
      'presentation:presentation:ended',
      handleStoppedPresentation,
    );

    this.unsubscribeSipConnectorEvents = () => {
      offStoppedByServerCommand();
      offPresentationFailed();
      offPresentationEnded();
    };
  }

  private readonly handleStop = () => {
    if (this.isNotStarted) {
      return;
    }

    this.stop({
      isStopPresentationTracks: true,
    }).catch((error: unknown) => {
      console.log('failed to stop presentation', error);
    });
  };

  private readonly handleStart = () => {
    if (this.isNotReady) {
      return;
    }

    this.updateUi();

    this.start({
      isStopPresentationTracks: true,
    }).catch((error: unknown) => {
      console.log('failed to start presentation', error);
    });
  };

  private readonly handleStartStressTesting = () => {
    if (this.isNotReady) {
      return;
    }

    this.setStartedStressTesting();
    this.updateUi();

    this.startStressTesting()
      .then(() => {
        console.log('stress testing presentation has successful');
      })
      .catch((error: unknown) => {
        console.log('failed to start presentation', error);
      })
      .finally(() => {
        this.setStoppedStressTesting();
        this.updateUi();
      });
  };

  private async startStressTesting({
    maxAttemptsCount = 50,
    delayBetweenAttempts = 300,
    delayBetweenStartAndStop = 1000,
  }: {
    maxAttemptsCount?: number;
    delayBetweenAttempts?: number;
    delayBetweenStartAndStop?: number;
  } = {}): Promise<void> {
    const presentationStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    let attemptsCount = 0;

    const wait = async (delay: number) => {
      return new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    };

    const runAttempt = async () => {
      attemptsCount += 1;

      console.log('stress testing - attempt:', attemptsCount);

      await this.startByMediaStream({ presentationStream, isStopPresentationTracks: false });

      await wait(delayBetweenStartAndStop);

      await this.stop({ isStopPresentationTracks: false });

      if (attemptsCount < maxAttemptsCount) {
        await wait(delayBetweenAttempts);

        await runAttempt();
      }
    };

    await runAttempt().finally(() => {
      // Останавливаем медиа-поток по завершении процесса стресс-тестирования
      presentationStream.getVideoTracks().forEach((videoTrack) => {
        videoTrack.stop();
      });
    });
  }

  private async start({
    isStopPresentationTracks,
  }: {
    isStopPresentationTracks: boolean;
  }): Promise<void> {
    const presentationStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    await this.startByMediaStream({ presentationStream, isStopPresentationTracks });
  }

  private async startByMediaStream({
    presentationStream,
    isStopPresentationTracks,
  }: {
    presentationStream: MediaStream;
    isStopPresentationTracks: boolean;
  }): Promise<void> {
    this.setStarting();
    this.updateUi();

    try {
      this.presentationStream = presentationStream;

      this.subscribeEndedVideoTrack({ presentationStream, isStopPresentationTracks });

      this.videoPlayer?.setStream(presentationStream);
      this.videoPlayer?.setPlaying(true);

      await sipConnectorFacade.startPresentation({
        mediaStream: presentationStream,
        isP2P: false,
      });

      this.subscribeSipConnectorEvents({ isStopPresentationTracks });

      this.setStarted();
      this.updateUi();

      console.log('presentation started');
    } catch (error: unknown) {
      this.resetPresentation({ isStopPresentationTracks });

      throw error;
    }
  }

  private subscribeEndedVideoTrack({
    presentationStream,
    isStopPresentationTracks,
  }: {
    presentationStream: MediaStream;
    isStopPresentationTracks: boolean;
  }) {
    this.unsubscribeEndedVideoTrack?.();

    const [videoTrack] = presentationStream.getVideoTracks();

    const handleEnded = () => {
      this.resetPresentation({ isStopPresentationTracks });
    };

    videoTrack.addEventListener('ended', handleEnded, { once: true });

    this.unsubscribeEndedVideoTrack = () => {
      videoTrack.removeEventListener('ended', handleEnded);
    };
  }

  private readonly resetPresentation = ({
    isStopPresentationTracks,
  }: {
    isStopPresentationTracks: boolean;
  }) => {
    this.unsubscribeSipConnectorEvents?.();
    this.unsubscribeEndedVideoTrack?.();

    if (isStopPresentationTracks) {
      this.stopPresentationTracks();
    }

    this.resetPresentationStream();
    this.setReady();
    this.updateUi();

    this.videoPlayer?.clear();
  };

  private updateUi() {
    this.updateStartPresentationElement();
    this.updateStartStressTestingPresentationElement();
    this.updateStopPresentationElement();
    this.updatePresentationVideoElement();
  }

  private updateStopPresentationElement() {
    if (this.isStarted && this.isNotStartedStressTesting) {
      dom.stopPresentationElement.classList.remove('hidden');
    } else {
      dom.stopPresentationElement.classList.add('hidden');
    }
  }

  private updateStartPresentationElement() {
    if (this.isReady && this.isNotStartedStressTesting) {
      dom.startPresentationElement.classList.remove('hidden');
    } else {
      dom.startPresentationElement.classList.add('hidden');
    }
  }

  private updateStartStressTestingPresentationElement() {
    if (this.isReady) {
      dom.startStressTestingPresentationElement.classList.remove('hidden');
    } else {
      dom.startStressTestingPresentationElement.classList.add('hidden');
    }
  }

  private updatePresentationVideoElement() {
    if (this.isStarted && this.isNotStartedStressTesting) {
      dom.presentationVideoElement.classList.remove('hidden');
    } else {
      dom.presentationVideoElement.classList.add('hidden');
    }
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

  private async stop({
    isStopPresentationTracks,
  }: {
    isStopPresentationTracks: boolean;
  }): Promise<void> {
    if (this.isNotStarted) {
      return;
    }

    this.setStopping();
    this.updateUi();

    try {
      await sipConnectorFacade.stopShareSipConnector({ isP2P: false });

      console.log('presentation stopped');
    } finally {
      this.resetPresentation({ isStopPresentationTracks });
    }
  }

  private setIdle() {
    this.state = 'idle';
  }

  private setReady() {
    this.state = 'ready';
  }

  private setStarting() {
    this.state = 'starting';
  }

  private setStarted() {
    this.state = 'started';
  }

  private setStopping() {
    this.state = 'stopping';
  }

  private setStartedStressTesting() {
    this.stressTestingState = 'started';
  }

  private setStoppedStressTesting() {
    this.stressTestingState = 'stopped';
  }
}

export default PresentationManager;
