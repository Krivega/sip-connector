import type { UA } from '@krivega/jssip';

export interface IConnectionConfiguration {
  sipServerUrl?: string;
  displayName?: string;
  register?: boolean;
  user?: string;
  password?: string;
}

export interface ConfigurationManagerDependencies {
  getUa: () => UA | undefined;
}

export default class ConfigurationManager {
  private data: IConnectionConfiguration = {};

  private readonly getUa: () => UA | undefined;

  public constructor(dependencies: ConfigurationManagerDependencies) {
    this.getUa = dependencies.getUa;
  }

  /**
   * Проверяет, настроено ли соединение
   */
  public isConfigured(): boolean {
    const ua = this.getUa();

    return ua !== undefined;
  }

  /**
   * Получает текущую конфигурацию подключения
   */
  public get(): IConnectionConfiguration {
    return { ...this.data };
  }

  /**
   * Устанавливает конфигурацию подключения
   */
  public set(data: IConnectionConfiguration): void {
    this.data = { ...data };
  }

  /**
   * Обновляет конфигурацию подключения
   */
  public update<K extends keyof IConnectionConfiguration>(
    key: K,
    value: IConnectionConfiguration[K],
  ): void {
    this.data[key] = value;
  }

  /**
   * Очищает конфигурацию
   */
  public clear(): void {
    this.data = {} as IConnectionConfiguration;
  }

  /**
   * Проверяет, включена ли регистрация в конфигурации
   */
  public isRegister(): boolean {
    return this.data.register === true;
  }

  /**
   * Получает SIP сервер URL из конфигурации
   */
  public getSipServerUrl(): string | undefined {
    return this.data.sipServerUrl;
  }

  /**
   * Получает display name из конфигурации
   */
  public getDisplayName(): string | undefined {
    return this.data.displayName;
  }

  /**
   * Получает пользователя из конфигурации
   */
  public getUser(): string | undefined {
    return this.data.user;
  }

  /**
   * Получает пароль из конфигурации
   */
  public getPassword(): string | undefined {
    return this.data.password;
  }

  /**
   * Проверяет, включена ли регистрация
   */
  public isRegisterEnabled(): boolean {
    return this.data.register === true;
  }
}
