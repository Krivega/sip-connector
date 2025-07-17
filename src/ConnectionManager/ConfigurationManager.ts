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
  private connectionConfiguration: IConnectionConfiguration = {};

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
  public getConnectionConfiguration(): IConnectionConfiguration {
    return { ...this.connectionConfiguration };
  }

  /**
   * Устанавливает конфигурацию подключения
   */
  public setConnectionConfiguration(config: IConnectionConfiguration): void {
    this.connectionConfiguration = config;
  }

  /**
   * Проверяет, включена ли регистрация в конфигурации
   */
  public isRegister(): boolean {
    return this.connectionConfiguration.register === true;
  }

  /**
   * Получает SIP сервер URL из конфигурации
   */
  public getSipServerUrl(): string | undefined {
    return this.connectionConfiguration.sipServerUrl;
  }

  /**
   * Получает display name из конфигурации
   */
  public getDisplayName(): string | undefined {
    return this.connectionConfiguration.displayName;
  }

  /**
   * Получает пользователя из конфигурации
   */
  public getUser(): string | undefined {
    return this.connectionConfiguration.user;
  }

  /**
   * Получает пароль из конфигурации
   */
  public getPassword(): string | undefined {
    return this.connectionConfiguration.password;
  }

  /**
   * Проверяет, включена ли регистрация
   */
  public isRegisterEnabled(): boolean {
    return this.connectionConfiguration.register === true;
  }

  /**
   * Очищает конфигурацию
   */
  public clearConfiguration(): void {
    this.connectionConfiguration = {};
  }
}
