/* eslint-disable no-console */
import { dom } from './dom';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type VideoPlayer from './VideoPlayer';

type TState = 'idle' | 'ready' | 'starting' | 'started' | 'stopping';
type TStressTestingState = 'started' | 'stopped';

class PresentationManager {
  private state: TState = 'idle';

  private stressTestingState: TStressTestingState = 'stopped';

  private videoPlayer: VideoPlayer | undefined = undefined;

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

  private get isIdle() {
    return this.state === 'idle';
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
    this.resetPresentation();
    this.setStoppedStressTesting();
    this.setIdle();
    this.updateUi();
  }

  public setVideoPlayer(videoPlayer: VideoPlayer): void {
    this.videoPlayer = videoPlayer;
  }

  private subscribeSipConnectorEvents(): void {
    this.unsubscribeSipConnectorEvents?.();

    const handleStoppedPresentation = () => {
      this.resetPresentation();
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

    this.stop().catch((error: unknown) => {
      console.log('failed to stop presentation', error);
    });
  };

  private readonly handleStart = () => {
    if (this.isNotReady) {
      return;
    }

    this.updateUi();

    this.start().catch((error: unknown) => {
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

  private async startStressTesting(): Promise<void> {
    const maxAttemptsCount = dom.presentationStressMaxAttemptsCountInputElement.valueAsNumber;
    const delayBetweenAttempts =
      dom.presentationStressDelayBetweenAttemptsInputElement.valueAsNumber;
    const delayBetweenStartAndStop =
      dom.presentationStressDelayBetweenStartAndStopInputElement.valueAsNumber;

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

      dom.startStressTestingPresentationTextElement.textContent = `Попытка ${attemptsCount} из ${maxAttemptsCount}...`;

      const [sourceVideoTrack] = presentationStream.getVideoTracks();
      const clonedTrack = sourceVideoTrack.clone(); // ключевой момент
      const attemptStream = new MediaStream([clonedTrack]);

      console.log('stress testing - attempt:', attemptsCount);

      await this.startByMediaStream({ presentationStream: attemptStream });

      await wait(delayBetweenStartAndStop);

      await this.stop();

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

  private async start(): Promise<void> {
    const presentationStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    await this.startByMediaStream({ presentationStream });
  }

  private async startByMediaStream({
    presentationStream,
  }: {
    presentationStream: MediaStream;
  }): Promise<void> {
    this.setStarting();
    this.updateUi();

    try {
      this.videoPlayer?.setStream(presentationStream);
      this.videoPlayer?.setPlaying(true);

      await sipConnectorFacade.startPresentation({
        mediaStream: presentationStream,
      });

      this.subscribeSipConnectorEvents();

      this.setStarted();
      this.updateUi();

      console.log('presentation started');
    } catch (error: unknown) {
      this.resetPresentation();

      throw error;
    }
  }

  private readonly resetPresentation = () => {
    this.unsubscribeSipConnectorEvents?.();

    this.setReady();
    this.updateUi();

    this.videoPlayer?.clear();
  };

  private updateUi() {
    this.updateStartPresentationElement();
    this.updateStartStressTestingPresentationElement();
    this.updateStartStressTestingPresentationTextElement();
    this.updateStopPresentationElement();
    this.updatePresentationVideoElement();
    this.updatePresentationStressTestingSection();
  }

  private updateStopPresentationElement() {
    if (this.isStarted && this.isNotStartedStressTesting) {
      dom.show(dom.stopPresentationElement);
    } else {
      dom.hide(dom.stopPresentationElement);
    }
  }

  private updateStartPresentationElement() {
    if (this.isReady && this.isNotStartedStressTesting) {
      dom.show(dom.startPresentationElement);
    } else {
      dom.hide(dom.startPresentationElement);
    }
  }

  private updateStartStressTestingPresentationElement() {
    if (this.isStartedStressTesting) {
      dom.disable(dom.startStressTestingPresentationElement);
    } else {
      dom.enable(dom.startStressTestingPresentationElement);
    }

    if (this.isIdle) {
      dom.hide(dom.startStressTestingPresentationElement);
    } else {
      dom.show(dom.startStressTestingPresentationElement);
    }
  }

  private updateStartStressTestingPresentationTextElement() {
    if (this.isNotStartedStressTesting) {
      dom.startStressTestingPresentationTextElement.innerHTML =
        'Начать стрессовое тестирование презентации';
    }

    if (this.isIdle || (this.isNotStartedStressTesting && this.isStarted)) {
      dom.hide(dom.startStressTestingPresentationElement);
    } else {
      dom.show(dom.startStressTestingPresentationElement);
    }
  }

  private updatePresentationVideoElement() {
    if (this.isStarted) {
      dom.show(dom.presentationVideoElement);
    } else {
      dom.hide(dom.presentationVideoElement);
    }
  }

  private updatePresentationStressTestingSection() {
    if (this.isIdle) {
      dom.hide(dom.presentationStressTestingSectionElement);
    } else {
      dom.show(dom.presentationStressTestingSectionElement);
    }
  }

  private async stop(): Promise<void> {
    if (this.isNotStarted) {
      return;
    }

    this.setStopping();
    this.updateUi();

    try {
      await sipConnectorFacade.stopPresentation();

      console.log('presentation stopped');
    } finally {
      this.resetPresentation();
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
