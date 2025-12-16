import parseDisplayName from '../utils/parseDisplayName';

/**
 * Интерфейс состояния формы
 */
export interface IFormState {
  serverAddress: string;
  displayName: string;
  authEnabled: boolean;
  userNumber: string;
  password: string;
  conferenceNumber: string;
}

/**
 * Тип обработчика изменений формы
 */
export type TFormChangeHandler = (state: IFormState) => void;

/**
 * Класс для управления состоянием формы
 * Инкапсулирует логику работы с состоянием и уведомления подписчиков
 */
class FormState {
  private readonly initialState: IFormState = {
    serverAddress: '',
    displayName: '',
    authEnabled: false,
    userNumber: '',
    password: '',
    conferenceNumber: '',
  };

  private state: IFormState = this.initialState;

  private readonly changeHandlers: Set<TFormChangeHandler> = new Set<TFormChangeHandler>();

  private readonly storageKey: string;

  /**
   * Создает экземпляр FormState
   * @param storageKey - Ключ для хранения состояния в localStorage
   */
  public constructor(storageKey = 'formState') {
    this.storageKey = storageKey;
    this.loadFromStorage();
  }

  /**
   * Проверяет валидность состояния
   */
  private static isValidState(state: unknown): state is IFormState {
    if (typeof state !== 'object' || state === null) {
      return false;
    }

    const s = state as Record<string, unknown>;

    return (
      typeof s.serverAddress === 'string' &&
      typeof s.displayName === 'string' &&
      typeof s.authEnabled === 'boolean' &&
      typeof s.userNumber === 'string' &&
      typeof s.password === 'string' &&
      typeof s.conferenceNumber === 'string'
    );
  }

  /**
   * Возвращает текущее состояние формы
   */
  public getState(): Readonly<IFormState> {
    return { ...this.state };
  }

  /**
   * Устанавливает значение поля
   */
  public setField<K extends keyof IFormState>(field: K, value: IFormState[K]): void {
    this.state[field] =
      field === 'displayName' && typeof value === 'string'
        ? (parseDisplayName(value) as IFormState[K])
        : value;

    this.saveToStorage();
    this.notifyHandlers();
  }

  /**
   * Инициализирует состояние из объекта
   */
  public initialize(initialState: IFormState): void {
    this.state = {
      ...initialState,
      displayName: parseDisplayName(initialState.displayName),
    };
    this.saveToStorage();
    this.notifyHandlers();
  }

  /**
   * Подписывается на изменения состояния формы
   */
  public onChange(handler: TFormChangeHandler): () => void {
    this.changeHandlers.add(handler);

    // Возвращаем функцию для отписки
    return () => {
      this.changeHandlers.delete(handler);
    };
  }

  /**
   * Сбрасывает состояние к начальному
   */
  public reset(): void {
    this.state = this.initialState;
    this.clearStorage();
    this.notifyHandlers();
  }

  /**
   * Очищает состояние из localStorage
   */
  public clearStorage(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // Игнорируем ошибки очистки localStorage
    }
  }

  /**
   * Уведомляет всех подписчиков об изменении состояния
   */
  private notifyHandlers(): void {
    const currentState = this.getState();

    this.changeHandlers.forEach((handler) => {
      handler(currentState);
    });
  }

  /**
   * Сохраняет состояние в localStorage
   */
  private saveToStorage(): void {
    try {
      const serialized = JSON.stringify(this.state);

      localStorage.setItem(this.storageKey, serialized);
    } catch {
      // Игнорируем ошибки сохранения в localStorage
      // (например, если localStorage недоступен или переполнен)
    }
  }

  /**
   * Загружает состояние из localStorage
   */
  private loadFromStorage(): void {
    try {
      const serialized = localStorage.getItem(this.storageKey);

      if (serialized !== null && serialized !== '') {
        const parsed = JSON.parse(serialized) as IFormState;

        // Валидируем структуру загруженных данных
        if (FormState.isValidState(parsed)) {
          this.state = {
            ...parsed,
            displayName: parseDisplayName(parsed.displayName),
          };
        }
      }
    } catch {
      // Игнорируем ошибки загрузки из localStorage
      // (например, если данные повреждены или localStorage недоступен)
    }
  }
}

export default FormState;
