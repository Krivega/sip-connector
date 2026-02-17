import { dom } from '../dom';
import sipConnectorFacade from './sipConnectorFacade';

import type { TEffectiveQuality, TRecvQuality } from '@/index';

type TRecvQualityChangedEvent = {
  effectiveQuality: TEffectiveQuality;
  previousQuality: TRecvQuality;
  quality: TRecvQuality;
};

class RecvQualityManager {
  private unsubscribeQualityChanged?: () => void;

  private unsubscribeRecvSessionStarted?: () => void;

  public subscribe(): void {
    dom.applyRecvQualityButtonElement.addEventListener('click', this.handleApplyClick);
    this.unsubscribeQualityChanged = sipConnectorFacade.on(
      'call:recv-quality-changed',
      this.handleQualityChanged,
    );
    this.unsubscribeRecvSessionStarted = sipConnectorFacade.on(
      'call:recv-session-started',
      this.syncCurrentQuality,
    );
  }

  public unsubscribe(): void {
    dom.applyRecvQualityButtonElement.removeEventListener('click', this.handleApplyClick);
    this.unsubscribeQualityChanged?.();
    this.unsubscribeQualityChanged = undefined;
    this.unsubscribeRecvSessionStarted?.();
    this.unsubscribeRecvSessionStarted = undefined;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public reset(): void {
    dom.recvQualitySelectElement.value = 'auto';
    dom.recvQualityStatusElement.textContent = '';
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly syncCurrentQuality = (prefix = 'Текущее'): void => {
    const recvQuality = sipConnectorFacade.sipConnector.getRecvQuality();

    dom.recvQualitySelectElement.value = recvQuality?.quality ?? 'undefined';
    dom.recvQualityStatusElement.textContent = `${prefix}: ${recvQuality?.quality} (${recvQuality?.effectiveQuality})`;
  };

  private readonly handleApplyClick = (): void => {
    const quality = dom.recvQualitySelectElement.value as TRecvQuality;

    sipConnectorFacade.sipConnector
      .setRecvQuality(quality)
      .then((applied) => {
        if (applied) {
          this.syncCurrentQuality('Применено');
        } else {
          dom.recvQualityStatusElement.textContent = `Не применено: ${quality}`;
        }
      })
      .catch(() => {
        dom.recvQualityStatusElement.textContent = 'Ошибка применения качества';
      });
  };

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly handleQualityChanged = (event: TRecvQualityChangedEvent): void => {
    dom.recvQualityStatusElement.textContent = `Применено: ${event.quality} (${event.effectiveQuality})`;
  };
}

export default RecvQualityManager;
