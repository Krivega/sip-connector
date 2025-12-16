import FormState from './FormState';

import type { IFormState, TFormChangeHandler } from './FormState';

/**
 * Тип обработчика отправки формы
 */
type TFormSubmitHandler = (state: IFormState, event: SubmitEvent) => void;

/**
 * Интерфейс для хранения элементов формы
 */
interface IFormElements {
  serverAddress: HTMLInputElement;
  displayName: HTMLInputElement;
  authEnabled: HTMLInputElement;
  userNumber: HTMLInputElement;
  password: HTMLInputElement;
  conferenceNumber: HTMLInputElement;
  userNumberLabel: HTMLLabelElement;
  passwordLabel: HTMLLabelElement;
}

/**
 * Класс для управления состоянием полей формы
 * Отслеживает изменения в полях ввода и хранит их состояние
 */
class FormStateManager {
  private readonly formState: FormState;

  private readonly form: HTMLFormElement;

  private readonly elements: IFormElements;

  private readonly submitHandlers: Set<TFormSubmitHandler> = new Set<TFormSubmitHandler>();

  /**
   * Создает экземпляр FormStateManager
   * @param formId - ID формы в DOM
   */
  public constructor(formId: string) {
    const formElement = document.querySelector<HTMLFormElement>(`#${formId}`);

    if (!formElement) {
      throw new Error(`Form with id "${formId}" not found`);
    }

    this.form = formElement;
    this.formState = new FormState();
    this.elements = this.initializeElements();
    this.fillFields();
    this.subscribeToChanges();
    this.subscribeToSubmit();
  }

  /**
   * Возвращает текущее состояние формы
   */
  public getState(): Readonly<IFormState> {
    return this.formState.getState();
  }

  /**
   * Устанавливает значение поля
   */
  public setField<K extends keyof IFormState>(field: K, value: IFormState[K]): void {
    const element = this.elements[field];

    if (element.type === 'checkbox') {
      element.checked = value as boolean;

      if (field === 'authEnabled') {
        this.updateAuthFieldsVisibility();
        this.updateAuthFieldsRequired();
      }
    } else {
      element.value = value as string;
    }

    this.formState.setField(field, value);
  }

  /**
   * Подписывается на изменения состояния формы
   */
  public onChange(handler: TFormChangeHandler): () => void {
    return this.formState.onChange(handler);
  }

  /**
   * Подписывается на отправку формы
   */
  public onSubmit(handler: TFormSubmitHandler): () => void {
    this.submitHandlers.add(handler);

    // Возвращаем функцию для отписки
    return () => {
      this.submitHandlers.delete(handler);
    };
  }

  /**
   * Валидирует форму
   */
  public validate(): boolean {
    return this.form.checkValidity();
  }

  /**
   * Сбрасывает форму к начальному состоянию
   */
  public reset(): void {
    this.form.reset();
    this.formState.clearStorage();
    this.fillFields();
  }

  /**
   * Инициализирует элементы формы из DOM
   */
  private initializeElements(): IFormElements {
    const serverAddress = this.form.querySelector<HTMLInputElement>('input[name="serverAddress"]');
    const displayName = this.form.querySelector<HTMLInputElement>('input[name="displayName"]');
    const authEnabled = this.form.querySelector<HTMLInputElement>(
      'input[type="checkbox"][name="authEnabled"]',
    );
    const userNumber = this.form.querySelector<HTMLInputElement>('input[name="userNumber"]');
    const password = this.form.querySelector<HTMLInputElement>('input[name="password"]');
    const conferenceNumber = this.form.querySelector<HTMLInputElement>(
      'input[name="conferenceNumber"]',
    );
    const userNumberLabel = this.form.querySelector<HTMLLabelElement>('label[for="userNumber"]');
    const passwordLabel = this.form.querySelector<HTMLLabelElement>('label[for="password"]');

    if (
      !serverAddress ||
      !displayName ||
      !authEnabled ||
      !userNumber ||
      !password ||
      !conferenceNumber ||
      !userNumberLabel ||
      !passwordLabel
    ) {
      throw new Error('Required form elements not found');
    }

    return {
      serverAddress,
      displayName,
      authEnabled,
      userNumber,
      password,
      conferenceNumber,
      userNumberLabel,
      passwordLabel,
    };
  }

  /**
   * Инициализирует начальные значения полей из DOM
   */
  private fillFields(): void {
    const state = this.getState();

    this.elements.serverAddress.value = state.serverAddress;
    this.elements.displayName.value = state.displayName;
    this.elements.authEnabled.checked = state.authEnabled;
    this.elements.userNumber.value = state.userNumber;
    this.elements.password.value = state.password;
    this.elements.conferenceNumber.value = state.conferenceNumber;

    this.updateAuthFieldsVisibility();
    this.updateAuthFieldsRequired();
  }

  /**
   * Подписывается на изменения в полях формы
   */
  private subscribeToChanges(): void {
    this.form.addEventListener('input', this.handleInputChange.bind(this));
    this.form.addEventListener('change', this.handleInputChange.bind(this));
  }

  /**
   * Подписывается на отправку формы
   */
  private subscribeToSubmit(): void {
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
  }

  /**
   * Обрабатывает изменения в полях формы
   */
  private handleInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const { name, type } = target;

    switch (name) {
      case 'serverAddress': {
        this.formState.setField('serverAddress', target.value);
        break;
      }
      case 'displayName': {
        this.formState.setField('displayName', target.value);
        break;
      }
      case 'authEnabled': {
        if (type === 'checkbox') {
          this.formState.setField('authEnabled', target.checked);
          this.updateAuthFieldsVisibility();
          this.updateAuthFieldsRequired();
        }

        break;
      }
      case 'userNumber': {
        this.formState.setField('userNumber', target.value);
        break;
      }
      case 'password': {
        this.formState.setField('password', target.value);
        break;
      }
      case 'conferenceNumber': {
        this.formState.setField('conferenceNumber', target.value);
        break;
      }
      default:
    }
  }

  /**
   * Обрабатывает отправку формы
   */
  private handleSubmit(event: SubmitEvent): void {
    const currentState = this.getState();

    this.submitHandlers.forEach((handler) => {
      handler(currentState, event);
    });
  }

  /**
   * Обновляет видимость полей userNumber и password
   * в зависимости от состояния authEnabled
   */
  private updateAuthFieldsVisibility(): void {
    const state = this.formState.getState();

    this.elements.userNumberLabel.style.display = state.authEnabled ? '' : 'none';
    this.elements.passwordLabel.style.display = state.authEnabled ? '' : 'none';
  }

  /**
   * Обновляет обязательность полей userNumber и password
   * в зависимости от состояния authEnabled
   */
  private updateAuthFieldsRequired(): void {
    const state = this.formState.getState();

    if (state.authEnabled) {
      this.elements.userNumber.setAttribute('required', '');
      this.elements.password.setAttribute('required', '');
    } else {
      this.elements.userNumber.removeAttribute('required');
      this.elements.password.removeAttribute('required');
    }
  }
}

export default FormStateManager;
