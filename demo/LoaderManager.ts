/**
 * Класс для управления overlay-лоадером
 * Отображает индикатор загрузки с текстовым сообщением
 */
class LoaderManager {
  private readonly overlay: HTMLElement | undefined = undefined;

  private messageElement: HTMLElement | undefined = undefined;

  /**
   * Создает экземпляр LoaderManager
   * @param overlayId - ID overlay элемента в DOM
   */
  public constructor(overlayId: string) {
    const overlayElement = document.querySelector<HTMLElement>(`#${overlayId}`);

    if (!overlayElement) {
      throw new Error(`Overlay element with id "${overlayId}" not found`);
    }

    this.overlay = overlayElement;
    this.initializeOverlay();
  }

  /**
   * Показывает лоадер с сообщением
   */
  public show(message = 'Загрузка...'): void {
    if (this.overlay && this.messageElement) {
      this.messageElement.textContent = message;
      this.overlay.style.display = 'flex';
    }
  }

  /**
   * Скрывает лоадер
   */
  public hide(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
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
    if (!this.overlay) {
      return;
    }

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
    this.overlay.append(loaderContainer);

    // Изначально скрываем overlay
    this.overlay.style.display = 'none';
  }
}

export default LoaderManager;
