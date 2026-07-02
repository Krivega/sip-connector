/// <reference types="jest" />
import {
  SIP_SERVER_URL,
  dataForConnectionWithAuthorization,
  dataForConnectionWithAuthorizationWithDisplayName,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithoutDisplayName,
  extraHeadersRemoteAddress,
  remoteAddress,
  uaConfigWithAuthorization,
  uaConfigWithAuthorizationWithDisplayName,
  uaConfigWithoutAuthorization,
  uaConfigWithoutAuthorizationWithoutDisplayName,
} from '@/__fixtures__';
import jssip from '@/__fixtures__/jssip.mock';
import UAMock, { createWebsocketHandshakeTimeoutError } from '@/__fixtures__/UA.mock';
import { uriWithName } from '@/tools/__fixtures__/connectToServer';
import ConnectionManager from '../@ConnectionManager';

import type { TJsSIP } from '@/types';

const wrongPassword = 'wrongPassword';
const websocketHandshakeTimeoutError = createWebsocketHandshakeTimeoutError(SIP_SERVER_URL);

const numberOfConnectionAttempts = 3;

describe('connect', () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager({
      JsSIP: jssip as unknown as TJsSIP,
    });
  });

  afterEach(() => {
    UAMock.resetStartError();
  });

  it('должен подключать пользователя с авторизацией', async () => {
    expect.assertions(1);

    await connectionManager.connect(dataForConnectionWithAuthorization);

    expect(connectionManager.ua?.configuration).toEqual(uaConfigWithAuthorization);
  });

  it('должен отклонять подключение с неправильным паролем', async () => {
    expect.assertions(1);

    const rejectedError = await connectionManager
      .connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        password: wrongPassword,
      })
      .catch((error: unknown) => {
        return error;
      });

    expect(rejectedError).toEqual({
      response: {
        status_code: 401,
        reason_phrase: 'Unauthorized',
      },
      cause: 'Rejected',
    });
  });

  it('должен изменять sipServerUrl при повторном подключении', async () => {
    expect.assertions(1);

    const sipServerUrlChanged = `${dataForConnectionWithAuthorization.sipServerUrl}Changed`;

    await connectionManager.connect(dataForConnectionWithAuthorization);

    await connectionManager.connect({
      ...dataForConnectionWithAuthorization,
      sipServerIp: sipServerUrlChanged,
    });

    expect(connectionManager.ua?.configuration).toEqual({
      ...uaConfigWithAuthorization,
      uri: uriWithName(uaConfigWithAuthorization.uri.user, sipServerUrlChanged),
    });
  });

  it('должен подключать пользователя с авторизацией и displayName', async () => {
    expect.assertions(6);

    await connectionManager.connect(dataForConnectionWithAuthorizationWithDisplayName);

    const connectionConfig = connectionManager.getConnectionConfiguration();

    expect(connectionConfig?.sipServerIp).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.sipServerIp,
    );
    expect(connectionConfig?.displayName).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.displayName,
    );
    expect(connectionConfig?.register).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.register,
    );
    expect(connectionConfig?.user).toBe(dataForConnectionWithAuthorizationWithDisplayName.user);
    expect(connectionConfig?.password).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.password,
    );
    expect(connectionManager.ua?.configuration).toEqual(uaConfigWithAuthorizationWithDisplayName);
  });

  it('должен подключать пользователя без авторизации', async () => {
    expect.assertions(6);

    await connectionManager.connect(dataForConnectionWithoutAuthorization);

    const { uri, ...config } = connectionManager.ua?.configuration ?? {};
    const connectionConfig = connectionManager.getConnectionConfiguration();

    expect(connectionConfig?.sipServerIp).toBe(dataForConnectionWithoutAuthorization.sipServerIp);
    expect(connectionConfig?.displayName).toBe(dataForConnectionWithoutAuthorization.displayName);
    expect(connectionConfig?.register).toBe(dataForConnectionWithoutAuthorization.register);
    expect(connectionConfig?.user).toBe(undefined);
    expect(connectionConfig?.password).toBe(undefined);

    expect(config).toEqual(uaConfigWithoutAuthorization);
  });

  it('должен подключать пользователя без авторизации и displayName', async () => {
    expect.assertions(6);

    await connectionManager.connect(dataForConnectionWithoutAuthorizationWithoutDisplayName);

    const { uri, ...config } = connectionManager.ua?.configuration ?? {};
    const connectionConfig = connectionManager.getConnectionConfiguration();

    expect(connectionConfig?.sipServerIp).toBe(
      dataForConnectionWithoutAuthorizationWithoutDisplayName.sipServerIp,
    );
    expect(connectionConfig?.displayName).toBe('DISPLAY_NAME');
    expect(connectionConfig?.register).toBe(false);
    expect(connectionConfig?.user).toBe(undefined);
    expect(connectionConfig?.password).toBe(undefined);
    expect(config).toEqual(uaConfigWithoutAuthorizationWithoutDisplayName);
  });

  it('должен сохранять connectionConfiguration после подключения', async () => {
    expect.assertions(5);

    await connectionManager.connect(dataForConnectionWithAuthorization);

    const connectionConfig = connectionManager.getConnectionConfiguration();

    expect(connectionConfig?.sipServerIp).toBe(dataForConnectionWithAuthorization.sipServerIp);
    expect(connectionConfig?.displayName).toBe('DISPLAY_NAME');
    expect(connectionConfig?.register).toBe(dataForConnectionWithAuthorization.register);
    expect(connectionConfig?.user).toBe(dataForConnectionWithAuthorization.user);
    expect(connectionConfig?.password).toBe(dataForConnectionWithAuthorization.password);
  });

  it('должен отправлять базовые extraHeaders', async () => {
    expect.assertions(1);

    await connectionManager.connect(dataForConnectionWithAuthorization);

    // @ts-expect-error
    expect(connectionManager.ua.registrator().extraHeaders).toEqual(extraHeadersRemoteAddress);
  });

  it('должен отправлять extraHeaders с remoteAddress', async () => {
    expect.assertions(2);

    await connectionManager.connect({
      ...dataForConnectionWithAuthorization,
      remoteAddress,
    });

    // @ts-expect-error
    expect(connectionManager.ua.registrator().extraHeaders).toEqual(extraHeadersRemoteAddress);
    expect(connectionManager.getConnectionConfiguration()?.remoteAddress).toBe(remoteAddress);
  });

  it('должен сохранять iceServers в connectionConfiguration', async () => {
    expect.assertions(1);

    const iceServers = [{ urls: 'stun:stun.example.com:3478' }];

    await connectionManager.connect({
      ...dataForConnectionWithAuthorization,
      iceServers,
    });

    expect(connectionManager.getConnectionConfiguration()?.iceServers).toEqual(iceServers);
  });

  it('должен отправлять расширенные extraHeaders', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    await connectionManager.connect({
      ...dataForConnectionWithAuthorization,
      extraHeaders,
    });

    // @ts-expect-error
    expect(connectionManager.ua.registrator().extraHeaders).toEqual([
      ...extraHeadersRemoteAddress,
      ...extraHeaders,
    ]);
  });

  it('должен отправлять расширенные extraHeaders с remoteAddress', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    await connectionManager.connect({
      ...dataForConnectionWithAuthorization,
      remoteAddress,
      extraHeaders,
    });

    // @ts-expect-error
    expect(connectionManager.ua.registrator().extraHeaders).toEqual([
      ...extraHeadersRemoteAddress,
      ...extraHeaders,
    ]);
  });

  it('должен повторять процесс подключения при ошибке 1006', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError);

    // @ts-expect-error
    const requestConnectMocked = jest.spyOn(connectionManager.connectionFlow, 'connectInner');

    try {
      await connectionManager.connect(dataForConnectionWithoutAuthorization, {
        numberOfConnectionAttempts,
      });
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('call limit (3) is reached'));
    }

    expect(requestConnectMocked).toHaveBeenCalledTimes(numberOfConnectionAttempts);
  });

  it('должен завершать процесс подключения после 2 неудачных попыток с ошибкой 1006', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError, { count: 2 });

    // @ts-expect-error
    const requestConnectMocked = jest.spyOn(connectionManager.connectionFlow, 'connectInner');

    await connectionManager.connect(dataForConnectionWithAuthorization, {
      numberOfConnectionAttempts,
    });

    expect(connectionManager.ua?.configuration).toEqual(uaConfigWithAuthorization);
    expect(requestConnectMocked).toHaveBeenCalledTimes(2);
  });
});
