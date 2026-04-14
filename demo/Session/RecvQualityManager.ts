import { dom } from '../dom';
import sipConnectorFacade from './sipConnectorFacade';
import resolveDebug from '../logger';

import type { TRecvQuality } from '@/index';

const debug = resolveDebug('demo:Session:RecvQualityManager');

function getCheckedRecvQuality(container: HTMLFieldSetElement): TRecvQuality | undefined {
  const input = container.querySelector<HTMLInputElement>('input[name="recvQuality"]:checked');

  return input?.value as TRecvQuality | undefined;
}

function setCheckedRecvQuality(container: HTMLFieldSetElement, quality?: TRecvQuality): void {
  const input = container.querySelector<HTMLInputElement>(
    `input[name="recvQuality"][value="${quality}"]`,
  );

  if (input) {
    input.checked = true;
  }
}

class RecvQualityManager {
  private unsubscribeQualityChanged?: () => void;

  private unsubscribeRecvSessionStarted?: () => void;

  public subscribe(): void {
    dom.recvQualityRadiosElement.addEventListener('change', this.handleChange);
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
    dom.recvQualityRadiosElement.removeEventListener('change', this.handleChange);
    this.unsubscribeQualityChanged?.();
    this.unsubscribeQualityChanged = undefined;
    this.unsubscribeRecvSessionStarted?.();
    this.unsubscribeRecvSessionStarted = undefined;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public reset(): void {
    setCheckedRecvQuality(dom.recvQualityRadiosElement, 'auto');
    dom.recvQualityStatusElement.textContent = '';
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly syncCurrentQuality = (prefix = 'Текущее'): void => {
    const recvQuality = sipConnectorFacade.sipConnector.getRecvQuality();
    const quality = recvQuality?.quality;

    setCheckedRecvQuality(dom.recvQualityRadiosElement, quality);
    dom.recvQualityStatusElement.textContent = `${prefix}: ${recvQuality?.quality} (${recvQuality?.effectiveQuality})`;
  };

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly handleChange = (): void => {
    const quality = getCheckedRecvQuality(dom.recvQualityRadiosElement);

    if (quality === undefined) {
      return;
    }

    dom.recvQualityRadiosElement.classList.add('disabled');

    sipConnectorFacade.sipConnector
      .setRecvQuality(quality)
      .then((applied) => {
        if (!applied) {
          dom.recvQualityStatusElement.textContent = `Не применено: ${quality}`;
        }
      })
      .catch((error: unknown) => {
        debug('setRecvQuality error:', error);

        dom.recvQualityStatusElement.textContent = 'Ошибка применения качества';
      })
      .finally(() => {
        dom.recvQualityRadiosElement.classList.remove('disabled');
      });
  };

  private readonly handleQualityChanged = (): void => {
    this.syncCurrentQuality('Применено');
  };
}

export default RecvQualityManager;
