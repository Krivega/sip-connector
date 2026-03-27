type TNotificationType = 'success' | 'info' | 'warning' | 'error';

type TShowParams = {
  message: string;
  type?: TNotificationType;
  isAutoHide?: boolean;
  timeoutMs?: number;
  id?: string;
};

const AUTO_HIDE_TIMEOUT_MS = 10_000;

const getElementById = (id: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(`#${id}`);

  if (!element) {
    throw new Error(`Element with id "${id}" not found`);
  }

  return element;
};

const formatTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

class NotificationManager {
  private readonly container: HTMLElement;

  private readonly timeoutById: Map<string, number> = new Map<string, number>();

  public constructor(containerId = 'notificationsContainer') {
    this.container = getElementById(containerId);
  }

  public show({
    message,
    id: idParameter,
    type = 'info',
    isAutoHide = false,
    timeoutMs,
  }: TShowParams): string {
    const id = idParameter ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const existingElement = this.container.querySelector<HTMLElement>(
      `[data-notification-id="${id}"]`,
    );
    const element = existingElement ?? document.createElement('div');

    element.className = `notification notification--${type}`;
    element.setAttribute('role', type === 'error' ? 'alert' : 'status');
    element.dataset.notificationId = id;

    const existingTimeElement = element.querySelector<HTMLElement>('.notification__time');
    const timeElement = existingTimeElement ?? document.createElement('div');

    timeElement.className = 'notification__time';
    timeElement.textContent = formatTime(new Date());

    const existingTextElement = element.querySelector<HTMLElement>('.notification__text');
    const textElement = existingTextElement ?? document.createElement('div');

    textElement.className = 'notification__text';
    textElement.textContent = message;

    const existingCloseButton = element.querySelector<HTMLButtonElement>('.notification__close');
    const closeButton = existingCloseButton ?? document.createElement('button');

    closeButton.className = 'notification__close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Закрыть уведомление');
    closeButton.textContent = '×';

    if (!existingCloseButton) {
      closeButton.addEventListener('click', () => {
        this.hide(id);
      });
    }

    if (!existingElement) {
      element.append(timeElement, textElement, closeButton);
      this.container.append(element);
    }

    const previousTimeoutId = this.timeoutById.get(id);

    if (previousTimeoutId !== undefined) {
      window.clearTimeout(previousTimeoutId);
      this.timeoutById.delete(id);
    }

    const resolvedTimeoutMs = timeoutMs ?? (isAutoHide ? AUTO_HIDE_TIMEOUT_MS : undefined);

    if (resolvedTimeoutMs !== undefined) {
      const timeoutId = window.setTimeout(() => {
        this.hide(id);
      }, resolvedTimeoutMs);

      this.timeoutById.set(id, timeoutId);
    }

    return id;
  }

  public hide(id: string): void {
    const timeoutId = this.timeoutById.get(id);

    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      this.timeoutById.delete(id);
    }

    const element = this.container.querySelector<HTMLElement>(`[data-notification-id="${id}"]`);

    if (!element) {
      return;
    }

    element.remove();
  }
}

export default NotificationManager;
