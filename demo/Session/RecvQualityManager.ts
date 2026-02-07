import { dom } from '../dom';
import sipConnectorFacade from './sipConnectorFacade';

import type { TEffectiveQuality, TRecvQuality } from '@/index';

type TRecvQualityChangedEvent = {
  previous?: TRecvQuality;
  next: TRecvQuality;
  applied: boolean;
  effectiveQuality?: TEffectiveQuality;
  reason?: string;
};

class RecvQualityManager {
  private unsubscribeQualityChanged?: () => void;

  public subscribe(): void {
    dom.applyRecvQualityButtonElement.addEventListener('click', this.handleApplyClick);
    this.unsubscribeQualityChanged = sipConnectorFacade.on(
      'call:recv-quality-changed',
      this.handleQualityChanged,
    );
    this.syncCurrentQuality();
  }

  public unsubscribe(): void {
    dom.applyRecvQualityButtonElement.removeEventListener('click', this.handleApplyClick);
    this.unsubscribeQualityChanged?.();
    this.unsubscribeQualityChanged = undefined;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public reset(): void {
    dom.recvQualitySelectElement.value = 'auto';
    dom.recvQualityStatusElement.textContent = '';
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private syncCurrentQuality(): void {
    const quality = sipConnectorFacade.sipConnector.getRecvQuality();

    dom.recvQualitySelectElement.value = quality;
    dom.recvQualityStatusElement.textContent = `Текущее: ${quality}`;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly handleApplyClick = (): void => {
    const quality = dom.recvQualitySelectElement.value as TRecvQuality;

    sipConnectorFacade.sipConnector
      .setRecvQuality(quality)
      .then((applied) => {
        dom.recvQualityStatusElement.textContent = applied
          ? `Применено: ${quality}`
          : `Не применено: ${quality}`;
      })
      .catch(() => {
        dom.recvQualityStatusElement.textContent = 'Ошибка применения качества';
      });
  };

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly handleQualityChanged = (event: TRecvQualityChangedEvent): void => {
    dom.recvQualityStatusElement.textContent = event.applied
      ? `Применено: ${event.next} (${event.effectiveQuality})`
      : `Не применено: ${event.next} (${event.reason})`;
  };
}

export default RecvQualityManager;
