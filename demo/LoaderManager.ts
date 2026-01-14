import { dom } from './dom';

/**
 * Класс для управления overlay-лоадером
 * Отображает индикатор загрузки с текстовым сообщением
 */

class LoaderManager {
  private messageElement: HTMLElement | undefined = undefined;

  /**
   * Создает экземпляр LoaderManager
   * @param overlayId - ID overlay элемента в DOM
   */
  public constructor() {
    this.initializeOverlay();
  }

  /**
   * Показывает лоадер с сообщением
   */
  public show(message = 'Загрузка...'): void {
    if (this.messageElement) {
      this.messageElement.textContent = message;
      dom.show(dom.overlayElement);
    }
  }

  /**
   * Скрывает лоадер
   */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public hide(): void {
    dom.hide(dom.overlayElement);
  }

  /**
   * Устанавливает сообщение лоадера
   */
  public setMessage(message: string): void {
    if (this.messageElement) {
      this.messageElement.textContent = message;
    }
  }

  /**
   * Инициализирует структуру overlay
   */
  private initializeOverlay(): void {
    // Создаем контейнер для лоадера
    const loaderContainer = document.createElement('div');

    loaderContainer.className = 'loader-container';

    // Создаем спиннер
    const spinner = document.createElement('div');

    spinner.className = 'loader-spinner';

    // Создаем элемент для сообщения
    const messageElement = document.createElement('div');

    messageElement.className = 'loader-message';
    messageElement.textContent = 'Загрузка...';

    this.messageElement = messageElement;

    loaderContainer.append(spinner);
    loaderContainer.append(messageElement);
    dom.overlayElement.append(loaderContainer);

    // Изначально скрываем overlay
    dom.hide(dom.overlayElement);
  }
}

export default LoaderManager;
