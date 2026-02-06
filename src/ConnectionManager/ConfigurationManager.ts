import type { UA } from '@krivega/jssip';

export type TConnectionConfiguration = {
  sipServerIp: string;
  sipServerUrl: string;
  displayName: string;
  authorizationUser: string;
  register?: boolean;
  user?: string;
  password?: string;
};

export interface ConfigurationManagerDependencies {
  getUa: () => UA | undefined;
}

export default class ConfigurationManager {
  private data: TConnectionConfiguration | undefined;

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
  public get(): TConnectionConfiguration | undefined {
    if (this.data === undefined) {
      return undefined;
    }

    return { ...this.data };
  }

  /**
   * Устанавливает конфигурацию подключения
   */
  public set(data: TConnectionConfiguration | undefined): void {
    if (data === undefined) {
      this.data = undefined;

      return;
    }

    this.data = { ...data };
  }

  /**
   * Обновляет конфигурацию подключения
   */
  public update<K extends keyof TConnectionConfiguration>(
    key: K,
    value: TConnectionConfiguration[K],
  ): void {
    if (this.data === undefined) {
      throw new Error('data is not exist');
    }

    this.data[key] = value;
  }

  /**
   * Очищает конфигурацию
   */
  public clear(): void {
    this.data = undefined;
  }

  /**
   * Проверяет, включена ли регистрация в конфигурации
   */
  public isRegister(): boolean {
    return this.data?.register === true;
  }

  /**
   * Получает SIP сервер IP из конфигурации
   */
  public getSipServerIp(): string | undefined {
    return this.data?.sipServerIp;
  }

  /**
   * Получает SIP сервер URL (WebSocket) из конфигурации
   */
  public getSipServerUrl(): string | undefined {
    return this.data?.sipServerUrl;
  }

  /**
   * Получает display name из конфигурации
   */
  public getDisplayName(): string | undefined {
    return this.data?.displayName;
  }

  /**
   * Получает пользователя из конфигурации
   */
  public getUser(): string | undefined {
    return this.data?.user;
  }

  /**
   * Получает пароль из конфигурации
   */
  public getPassword(): string | undefined {
    return this.data?.password;
  }

  /**
   * Проверяет, включена ли регистрация
   */
  public isRegisterEnabled(): boolean {
    return this.data?.register === true;
  }
}
