import { EContentUseLicense } from '@/index';
import { dom } from '../dom';
import sipConnectorFacade from './sipConnectorFacade';

/**
 * Тип обработчика изменений лицензии
 */
type TUseLicenseHandler = (license: EContentUseLicense) => void;

/**
 * Класс для управления состоянием лицензии
 * Отслеживает текущую лицензию использования (AUDIO/VIDEO/AUDIOPLUSPRESENTATION) и подписывается на события
 */
class UseLicenseManager {
  private license: EContentUseLicense | undefined = undefined;

  private readonly handlers: Set<TUseLicenseHandler> = new Set<TUseLicenseHandler>();

  private unsubscribeUseLicense: (() => void) | undefined = undefined;

  /**
   * Возвращает текущую лицензию
   */
  public getLicense(): EContentUseLicense | undefined {
    return this.license;
  }

  /**
   * Подписывается на события изменения лицензии
   */
  public subscribe(): void {
    // Подписываемся на событие изменения лицензии
    this.unsubscribeUseLicense = sipConnectorFacade.onUseLicense((license: EContentUseLicense) => {
      this.setLicense(license);
    });
    this.onChange(this.handleUseLicenseChange);
  }

  /**
   * Отписывается от событий изменения лицензии
   */
  public unsubscribe(): void {
    if (this.unsubscribeUseLicense) {
      this.unsubscribeUseLicense();
      this.unsubscribeUseLicense = undefined;
    }
  }

  /**
   * Подписывается на изменения лицензии
   */
  public onChange(handler: TUseLicenseHandler): () => void {
    this.handlers.add(handler);

    // Возвращаем функцию для отписки
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Сбрасывает лицензию
   */
  public reset(): void {
    this.setLicense(undefined);
  }

  /**
   * Устанавливает новую лицензию
   */
  private setLicense(newLicense: EContentUseLicense | undefined): void {
    if (this.license !== newLicense) {
      this.license = newLicense;
      this.notifyHandlers();
    }
  }

  /**
   * Уведомляет всех подписчиков об изменении лицензии
   */
  private notifyHandlers(): void {
    const { license } = this;

    if (license === undefined) {
      // При сбросе лицензии очищаем отображение
      dom.useLicenseElement.textContent = '';
    } else {
      this.handlers.forEach((handler) => {
        handler(license);
      });
    }
  }

  /**
   * Обрабатывает изменения лицензии
   */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private readonly handleUseLicenseChange = (license: EContentUseLicense): void => {
    let licenseText = '';

    switch (license) {
      case EContentUseLicense.AUDIO: {
        licenseText = 'Аудио';

        break;
      }

      case EContentUseLicense.VIDEO: {
        licenseText = 'Видео';

        break;
      }

      case EContentUseLicense.AUDIOPLUSPRESENTATION: {
        licenseText = 'Аудио + Презентация';

        break;
      }

      default: {
        licenseText = '';
      }
    }

    dom.useLicenseElement.textContent = licenseText;
  };
}

export default UseLicenseManager;
