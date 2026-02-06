/// <reference types="jest" />
import {
  SIP_SERVER_URL,
  dataForConnectionWithAuthorization,
  dataForConnectionWithAuthorizationWithDisplayName,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithoutDisplayName,
  extraHeadersRemoteAddress,
  remoteAddress,
  uaConfigurationWithAuthorization,
  uaConfigurationWithAuthorizationWithDisplayName,
  uaConfigurationWithoutAuthorization,
  uaConfigurationWithoutAuthorizationWithoutDisplayName,
} from '@/__fixtures__';
import jssip from '@/__fixtures__/jssip.mock';
import UAMock, { createWebsocketHandshakeTimeoutError } from '@/__fixtures__/UA.mock';
import { uriWithName } from '@/tools/__fixtures__/connectToServer';
import ConnectionManager from '../@ConnectionManager';

import type { TJsSIP } from '@/types';

const wrongPassword = 'wrongPassword';
const websocketHandshakeTimeoutError = createWebsocketHandshakeTimeoutError(SIP_SERVER_URL);

const connectCallLimit = 3;

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

    expect(connectionManager.ua?.configuration).toEqual(uaConfigurationWithAuthorization);
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
      ...uaConfigurationWithAuthorization,
      uri: uriWithName(uaConfigurationWithAuthorization.uri.user, sipServerUrlChanged),
    });
  });

  it('должен подключать пользователя с авторизацией и displayName', async () => {
    expect.assertions(6);

    await connectionManager.connect(dataForConnectionWithAuthorizationWithDisplayName);

    const connectionConfiguration = connectionManager.getConnectionConfiguration();

    expect(connectionConfiguration?.sipServerIp).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.sipServerIp,
    );
    expect(connectionConfiguration?.displayName).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.displayName,
    );
    expect(connectionConfiguration?.register).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.register,
    );
    expect(connectionConfiguration?.user).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.user,
    );
    expect(connectionConfiguration?.password).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.password,
    );
    expect(connectionManager.ua?.configuration).toEqual(
      uaConfigurationWithAuthorizationWithDisplayName,
    );
  });

  it('должен подключать пользователя без авторизации', async () => {
    expect.assertions(6);

    await connectionManager.connect(dataForConnectionWithoutAuthorization);

    const { uri, ...configuration } = connectionManager.ua?.configuration ?? {};
    const connectionConfiguration = connectionManager.getConnectionConfiguration();

    expect(connectionConfiguration?.sipServerIp).toBe(
      dataForConnectionWithoutAuthorization.sipServerIp,
    );
    expect(connectionConfiguration?.displayName).toBe(
      dataForConnectionWithoutAuthorization.displayName,
    );
    expect(connectionConfiguration?.register).toBe(dataForConnectionWithoutAuthorization.register);
    expect(connectionConfiguration?.user).toBe(undefined);
    expect(connectionConfiguration?.password).toBe(undefined);

    expect(configuration).toEqual(uaConfigurationWithoutAuthorization);
  });

  it('должен подключать пользователя без авторизации и displayName', async () => {
    expect.assertions(6);

    await connectionManager.connect(dataForConnectionWithoutAuthorizationWithoutDisplayName);

    const { uri, ...configuration } = connectionManager.ua?.configuration ?? {};
    const connectionConfiguration = connectionManager.getConnectionConfiguration();

    expect(connectionConfiguration?.sipServerIp).toBe(
      dataForConnectionWithoutAuthorizationWithoutDisplayName.sipServerIp,
    );
    expect(connectionConfiguration?.displayName).toBe('DISPLAY_NAME');
    expect(connectionConfiguration?.register).toBe(false);
    expect(connectionConfiguration?.user).toBe(undefined);
    expect(connectionConfiguration?.password).toBe(undefined);
    expect(configuration).toEqual(uaConfigurationWithoutAuthorizationWithoutDisplayName);
  });

  it('должен сохранять connectionConfiguration после подключения', async () => {
    expect.assertions(5);

    await connectionManager.connect(dataForConnectionWithAuthorization);

    const connectionConfiguration = connectionManager.getConnectionConfiguration();

    expect(connectionConfiguration?.sipServerIp).toBe(
      dataForConnectionWithAuthorization.sipServerIp,
    );
    expect(connectionConfiguration?.displayName).toBe('DISPLAY_NAME');
    expect(connectionConfiguration?.register).toBe(dataForConnectionWithAuthorization.register);
    expect(connectionConfiguration?.user).toBe(dataForConnectionWithAuthorization.user);
    expect(connectionConfiguration?.password).toBe(dataForConnectionWithAuthorization.password);
  });

  it('должен устанавливать displayName после подключения с авторизацией', async () => {
    const anotherDisplayName = 'anotherDisplayName';

    await connectionManager.connect(dataForConnectionWithAuthorizationWithDisplayName);

    const changed = await connectionManager.set({
      displayName: anotherDisplayName,
    });

    expect(changed).toBe(true);
    expect(connectionManager.getConnectionConfiguration()?.displayName).toBe(anotherDisplayName);
  });

  it('должен отправлять базовые extraHeaders', async () => {
    expect.assertions(1);

    await connectionManager.connect(dataForConnectionWithAuthorization);

    // @ts-expect-error
    expect(connectionManager.ua.registrator().extraHeaders).toEqual([]);
  });

  it('должен отправлять extraHeaders с remoteAddress', async () => {
    expect.assertions(1);

    await connectionManager.connect({
      ...dataForConnectionWithAuthorization,
      remoteAddress,
    });

    // @ts-expect-error
    expect(connectionManager.ua.registrator().extraHeaders).toEqual(extraHeadersRemoteAddress);
  });

  it('должен отправлять расширенные extraHeaders', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    await connectionManager.connect({
      ...dataForConnectionWithAuthorization,
      extraHeaders,
    });

    // @ts-expect-error
    expect(connectionManager.ua.registrator().extraHeaders).toEqual(extraHeaders);
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
        callLimit: connectCallLimit,
      });
    } catch (error) {
      // eslint-disable-next-line jest/no-conditional-expect
      expect(error).toEqual(new Error('call limit (3) is reached'));
    }

    expect(requestConnectMocked).toHaveBeenCalledTimes(connectCallLimit);
  });

  it('должен завершать процесс подключения после 2 неудачных попыток с ошибкой 1006', async () => {
    expect.assertions(2);

    UAMock.setStartError(websocketHandshakeTimeoutError, { count: 2 });

    // @ts-expect-error
    const requestConnectMocked = jest.spyOn(connectionManager.connectionFlow, 'connectInner');

    await connectionManager.connect(dataForConnectionWithAuthorization, {
      callLimit: connectCallLimit,
    });

    expect(connectionManager.ua?.configuration).toEqual(uaConfigurationWithAuthorization);
    expect(requestConnectMocked).toHaveBeenCalledTimes(2);
  });
});
