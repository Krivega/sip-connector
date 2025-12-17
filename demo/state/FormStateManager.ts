/* eslint-disable @typescript-eslint/class-methods-use-this */
import FormState from './FormState';
import { dom } from '../dom';

import type { IFormState, TFormChangeHandler } from './FormState';

const getElement = <K extends keyof IFormState>(field: K) => {
  const elements = {
    serverAddress: dom.serverAddressInput,
    displayName: dom.displayNameInput,
    authEnabled: dom.authEnabledInput,
    userNumber: dom.userNumberInput,
    password: dom.passwordInput,
    conferenceNumber: dom.conferenceNumberInput,
    userNumberLabel: dom.userNumberLabel,
    passwordLabel: dom.passwordLabel,
  };

  return elements[field];
};

/**
 * Тип обработчика отправки формы
 */
type TFormSubmitHandler = (state: IFormState, event: SubmitEvent) => void;

/**
 * Класс для управления состоянием полей формы
 * Отслеживает изменения в полях ввода и хранит их состояние
 */
class FormStateManager {
  private readonly formState: FormState;

  private readonly submitHandlers: Set<TFormSubmitHandler> = new Set<TFormSubmitHandler>();

  /**
   * Создает экземпляр FormStateManager
   * @param formId - ID формы в DOM
   */
  public constructor() {
    this.formState = new FormState();
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
    const element = getElement(field);

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
    return dom.formElement.checkValidity();
  }

  /**
   * Сбрасывает форму к начальному состоянию
   */
  public reset(): void {
    dom.formElement.reset();
    this.formState.clearStorage();
    this.fillFields();
  }

  /**
   * Инициализирует начальные значения полей из DOM
   */
  private fillFields(): void {
    const state = this.getState();

    getElement('serverAddress').value = state.serverAddress;
    getElement('displayName').value = state.displayName;
    getElement('authEnabled').checked = state.authEnabled;
    getElement('userNumber').value = state.userNumber;
    getElement('password').value = state.password;
    getElement('conferenceNumber').value = state.conferenceNumber;

    this.updateAuthFieldsVisibility();
    this.updateAuthFieldsRequired();
  }

  /**
   * Подписывается на изменения в полях формы
   */
  private subscribeToChanges(): void {
    dom.formElement.addEventListener('input', this.handleInputChange.bind(this));
    dom.formElement.addEventListener('change', this.handleInputChange.bind(this));
  }

  /**
   * Подписывается на отправку формы
   */
  private subscribeToSubmit(): void {
    dom.formElement.addEventListener('submit', this.handleSubmit.bind(this));
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

    dom.userNumberLabel.style.display = state.authEnabled ? '' : 'none';
    dom.passwordLabel.style.display = state.authEnabled ? '' : 'none';
  }

  /**
   * Обновляет обязательность полей userNumber и password
   * в зависимости от состояния authEnabled
   */
  private updateAuthFieldsRequired(): void {
    const state = this.formState.getState();

    if (state.authEnabled) {
      getElement('userNumber').setAttribute('required', '');
      getElement('password').setAttribute('required', '');
    } else {
      getElement('userNumber').removeAttribute('required');
      getElement('password').removeAttribute('required');
    }
  }
}

export default FormStateManager;
