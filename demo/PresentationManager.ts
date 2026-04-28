import { EPresentationStatus } from '@/index';
import { dom } from './dom';
import resolveDebug from './logger';
import sipConnectorFacade from './Session/sipConnectorFacade';

import type Statuses from './Statuses';
import type VideoPlayer from './VideoPlayer';

type TStressTestingState = 'started' | 'stopped';
type TPresentationState = EPresentationStatus;

const isPresentationStoppedState = (state: TPresentationState): boolean => {
  return state === EPresentationStatus.IDLE || state === EPresentationStatus.FAILED;
};

const isPresentationProcessState = (state: TPresentationState): boolean => {
  return (
    state === EPresentationStatus.STARTING ||
    state === EPresentationStatus.ACTIVE ||
    state === EPresentationStatus.STOPPING
  );
};

const debug = resolveDebug('PresentationManager');

class PresentationManager {
  private stressTestingState: TStressTestingState = 'stopped';

  private videoPlayer: VideoPlayer | undefined = undefined;

  private currentPresentationStream: MediaStream | undefined = undefined;

  private presentationState: TPresentationState = EPresentationStatus.IDLE;

  private isCallActive = false;

  private readonly statusesManager: Statuses;

  public constructor(statusesManager: Statuses) {
    this.statusesManager = statusesManager;

    dom.startPresentationElement.addEventListener('click', this.handleStart);
    dom.startStressTestingPresentationElement.addEventListener(
      'click',
      this.handleStartStressTesting,
    );
    dom.stopPresentationElement.addEventListener('click', this.handleStop);
    dom.stopStressTestingPresentationButton.addEventListener('click', this.handleStopStressTesting);

    this.statusesManager.onChangeSystemState(({ presentation, isCallActive }) => {
      const shouldResetPresentation =
        this.currentPresentationStream !== undefined &&
        isPresentationProcessState(this.presentationState) &&
        isPresentationStoppedState(presentation);

      this.presentationState = presentation;
      this.isCallActive = isCallActive;

      if (shouldResetPresentation) {
        this.resetPresentation();
      }

      this.updateUi();
    });
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
    return isPresentationStoppedState(this.presentationState);
  }

  private get isStarted() {
    return this.presentationState === EPresentationStatus.ACTIVE;
  }

  public activate(): void {
    this.updateUi();
  }

  public deactivate(): void {
    this.resetPresentation();
    this.setStoppedStressTesting();
    this.updateUi();
  }

  public setVideoPlayer(videoPlayer: VideoPlayer): void {
    this.videoPlayer = videoPlayer;
  }

  private readonly handleStop = () => {
    this.stop().catch((error: unknown) => {
      debug('failed to stop presentation', error);
    });
  };

  private readonly handleStart = () => {
    if (this.isNotReady) {
      return;
    }

    this.updateUi();

    this.start().catch((error: unknown) => {
      debug('failed to start presentation', error);
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
        debug('stress testing presentation has successful');
      })
      .catch((error: unknown) => {
        debug('failed to start presentation', error);
      })
      .finally(() => {
        this.setStoppedStressTesting();
        this.updateUi();
      });
  };

  private readonly handleStopStressTesting = () => {
    if (this.isNotStartedStressTesting) {
      return;
    }

    this.stopStressTesting().catch((error: unknown) => {
      debug('failed to stop stress testing presentation', error);
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

      dom.stressTestingPresentationStatusElement.textContent = `Попытка ${attemptsCount} из ${maxAttemptsCount}...`;

      const [sourceVideoTrack] = presentationStream.getVideoTracks();
      const clonedTrack = sourceVideoTrack.clone(); // ключевой момент
      const attemptStream = new MediaStream([clonedTrack]);

      debug('stress testing - attempt:', attemptsCount);

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

  private async stopStressTesting(): Promise<void> {
    await this.stop();

    this.setStoppedStressTesting();
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
    this.currentPresentationStream = presentationStream;

    try {
      this.videoPlayer?.setStream(presentationStream);
      this.videoPlayer?.setPlaying(true);

      await sipConnectorFacade.startPresentation({
        mediaStream: presentationStream,
      });

      debug('presentation started');
    } catch (error: unknown) {
      this.resetPresentation();

      throw error;
    }
  }

  private readonly resetPresentation = () => {
    this.currentPresentationStream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.currentPresentationStream = undefined;

    this.videoPlayer?.clear();

    this.updateUi();
  };

  private updateUi() {
    this.updateButtonsStartPresentationElement();
    this.updateStressTestingPresentationButtons();
    this.updatePresentationVideoElement();
    this.updatePresentationStressTestingSection();
  }

  private updateButtonsStartPresentationElement() {
    if (this.isStartedStressTesting || !this.isCallActive) {
      dom.hide(dom.startPresentationElement);
      dom.hide(dom.stopPresentationElement);

      return;
    }

    if (this.isReady) {
      dom.show(dom.startPresentationElement);
      dom.hide(dom.stopPresentationElement);
    } else {
      dom.show(dom.stopPresentationElement);
      dom.hide(dom.startPresentationElement);
    }
  }

  private updateStressTestingPresentationButtons() {
    if (this.isNotStartedStressTesting) {
      dom.hide(dom.stopStressTestingPresentationButton);
      dom.show(dom.startStressTestingPresentationElement);
      dom.hide(dom.stressTestingPresentationStatusElement);
    } else {
      dom.show(dom.stopStressTestingPresentationButton);
      dom.hide(dom.startStressTestingPresentationElement);
      dom.show(dom.stressTestingPresentationStatusElement);
    }

    if (this.isStartedStressTesting) {
      dom.disable(dom.startStressTestingPresentationElement);
    } else {
      dom.enable(dom.startStressTestingPresentationElement);
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
    if (this.isCallActive) {
      dom.show(dom.presentationStressTestingSectionElement);
    } else {
      dom.hide(dom.presentationStressTestingSectionElement);
    }
  }

  private async stop(): Promise<void> {
    try {
      await sipConnectorFacade.stopPresentation();

      debug('presentation stopped');
    } finally {
      this.resetPresentation();
    }
  }

  private setStartedStressTesting() {
    this.stressTestingState = 'started';
  }

  private setStoppedStressTesting() {
    this.stressTestingState = 'stopped';
  }
}

export default PresentationManager;
