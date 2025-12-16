/**
 * Тип состояния звонка
 */
export type TCallState = 'idle' | 'initializing' | 'connecting' | 'calling' | 'active';

/**
 * Тип обработчика изменений состояния звонка
 */
type TCallStateHandler = (state: TCallState) => void;

/**
 * Класс для управления состоянием звонка
 * Отслеживает текущее состояние процесса звонка
 */
class CallStateManager {
  private state: TCallState = 'idle';

  private readonly handlers: Set<TCallStateHandler> = new Set<TCallStateHandler>();

  /**
   * Возвращает текущее состояние звонка
   */
  public getState(): TCallState {
    return this.state;
  }

  /**
   * Устанавливает новое состояние звонка
   */
  public setState(newState: TCallState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyHandlers();
    }
  }

  /**
   * Подписывается на изменения состояния звонка
   */
  public onChange(handler: TCallStateHandler): () => void {
    this.handlers.add(handler);

    // Возвращаем функцию для отписки
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Сбрасывает состояние к idle
   */
  public reset(): void {
    this.setState('idle');
  }

  /**
   * Проверяет, активен ли звонок
   */
  public isActive(): boolean {
    return this.state === 'active';
  }

  /**
   * Проверяет, идет ли процесс (не idle)
   */
  public isInProgress(): boolean {
    return this.state !== 'idle';
  }

  /**
   * Уведомляет всех подписчиков об изменении состояния
   */
  private notifyHandlers(): void {
    this.handlers.forEach((handler) => {
      handler(this.state);
    });
  }
}

export default CallStateManager;
