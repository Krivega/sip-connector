import createSipConnector from '../__mocks__/doMock';
import {
  dataForConnectionWithAuthorization,
  dataForConnectionWithAuthorizationWithDisplayName,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithoutDisplayName,
  uaConfigurationWithAuthorization,
  uaConfigurationWithoutAuthorization,
  uaConfigurationWithAuthorizationWithDisplayName,
  uaConfigurationWithoutAuthorizationWithoutDisplayName,
  remoteAddress,
  extraHeadersRemoteAddress,
} from '../__mocks__';
import type SipConnector from '../SipConnector';

describe('sip-connector', () => {
  let sipConnector: SipConnector;

  beforeEach(() => {
    sipConnector = createSipConnector();
  });

  it('connect authorization user', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    expect(ua.configuration).toEqual(uaConfigurationWithAuthorization);
  });

  it('connect and change sipServerUrl', async () => {
    expect.assertions(1);

    const sipServerUrlChanged = `${dataForConnectionWithAuthorization.sipServerUrl}Changed`;
    const uriChanged = `${uaConfigurationWithAuthorization.uri}Changed`;

    await sipConnector.connect(dataForConnectionWithAuthorization);

    const ua = await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      sipServerUrl: sipServerUrlChanged,
    });

    expect(ua.configuration).toEqual({ ...uaConfigurationWithAuthorization, uri: uriChanged });
  });

  it('connect authorization user with displayName', async () => {
    expect.assertions(6);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.sipServerUrl
    );
    expect(connectionConfiguration.displayName).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.displayName
    );
    expect(connectionConfiguration.register).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.register
    );
    expect(connectionConfiguration.user).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.user
    );
    expect(connectionConfiguration.password).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.password
    );
    expect(ua.configuration).toEqual(uaConfigurationWithAuthorizationWithDisplayName);
  });

  it('connect without authorization', async () => {
    expect.assertions(6);

    const ua = await sipConnector.connect(dataForConnectionWithoutAuthorization);
    const { uri, ...configuration } = ua.configuration;
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithoutAuthorization.sipServerUrl
    );
    expect(connectionConfiguration.displayName).toBe(
      dataForConnectionWithoutAuthorization.displayName
    );
    expect(connectionConfiguration.register).toBe(dataForConnectionWithoutAuthorization.register);
    expect(connectionConfiguration.user).toBe(undefined);
    expect(connectionConfiguration.password).toBe(undefined);

    expect(configuration).toEqual(uaConfigurationWithoutAuthorization);
  });

  it('connect without authorization without displayName', async () => {
    expect.assertions(6);

    const ua = await sipConnector.connect(dataForConnectionWithoutAuthorizationWithoutDisplayName);
    const { uri, ...configuration } = ua.configuration;
    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithoutAuthorizationWithoutDisplayName.sipServerUrl
    );
    expect(connectionConfiguration.displayName).toBe('');
    expect(connectionConfiguration.register).toBe(false);
    expect(connectionConfiguration.user).toBe(undefined);
    expect(connectionConfiguration.password).toBe(undefined);
    expect(configuration).toEqual(uaConfigurationWithoutAuthorizationWithoutDisplayName);
  });

  it('connectionConfiguration after connect', async () => {
    expect.assertions(6);

    const connectPromise = sipConnector.connect(dataForConnectionWithAuthorization);

    expect(sipConnector.getConnectionConfiguration().answer).toBe(undefined);

    const connectionConfiguration = sipConnector.getConnectionConfiguration();

    expect(connectionConfiguration.sipServerUrl).toBe(
      dataForConnectionWithAuthorization.sipServerUrl
    );
    expect(connectionConfiguration.displayName).toBe('');
    expect(connectionConfiguration.register).toBe(dataForConnectionWithAuthorization.register);
    expect(connectionConfiguration.user).toBe(dataForConnectionWithAuthorization.user);
    expect(connectionConfiguration.password).toBe(dataForConnectionWithAuthorization.password);

    return connectPromise;
  });

  it('set password after connect with authorization', async () => {
    expect.assertions(3);

    const wrongPassword = 'wrongPassword';

    try {
      await sipConnector.connect({
        ...dataForConnectionWithAuthorizationWithDisplayName,
        password: wrongPassword,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('error', error);
    }

    expect(sipConnector.getConnectionConfiguration().password).toBe(wrongPassword);

    await sipConnector.set({
      password: dataForConnectionWithAuthorizationWithDisplayName.password,
    });

    expect(sipConnector.getConnectionConfiguration().password).toBe(
      dataForConnectionWithAuthorizationWithDisplayName.password
    );
    expect(sipConnector.ua!.configuration).toEqual(uaConfigurationWithAuthorizationWithDisplayName);
  });

  it('set same password after connect with authorization', async () => {
    expect.assertions(3);

    await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);

    return sipConnector
      .set({
        password: dataForConnectionWithAuthorizationWithDisplayName.password,
      })
      .catch((error) => {
        expect(error).toBe(false);
        expect(sipConnector.getConnectionConfiguration().password).toBe(
          dataForConnectionWithAuthorizationWithDisplayName.password
        );
        // @ts-ignore
        expect(sipConnector.ua!.configuration).toEqual(
          uaConfigurationWithAuthorizationWithDisplayName
        );
      });
  });

  it('set displayName after connect with authorization', async () => {
    const anotherDisplayName = 'anotherDisplayName';

    await sipConnector.connect(dataForConnectionWithAuthorizationWithDisplayName);
    await sipConnector.set({
      displayName: anotherDisplayName,
    });

    expect(sipConnector.getConnectionConfiguration().displayName).toBe(anotherDisplayName);
  });

  it('send base extraHeaders', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect(dataForConnectionWithAuthorization);

    // @ts-ignore
    expect(ua.registrator().extraHeaders).toEqual([]);
  });

  it('send extraHeaders with remoteAddress', async () => {
    expect.assertions(1);

    const ua = await sipConnector.connect({ ...dataForConnectionWithAuthorization, remoteAddress });

    // @ts-ignore
    expect(ua.registrator().extraHeaders).toEqual(extraHeadersRemoteAddress);
  });

  it('send extended extraHeaders', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    const ua = await sipConnector.connect({ ...dataForConnectionWithAuthorization, extraHeaders });

    // @ts-ignore
    expect(ua.registrator().extraHeaders).toEqual(extraHeaders);
  });

  it('send extended extraHeaders with remoteAddress', async () => {
    expect.assertions(1);

    const extraHeaders = ['test'];

    const ua = await sipConnector.connect({
      ...dataForConnectionWithAuthorization,
      remoteAddress,
      extraHeaders,
    });

    // @ts-ignore
    expect(ua.registrator().extraHeaders).toEqual([...extraHeadersRemoteAddress, ...extraHeaders]);
  });
});
