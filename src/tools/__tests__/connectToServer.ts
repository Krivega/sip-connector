import type SipConnector from '../../SipConnector';
import doMockSIPconnector from '../../__fixtures__/doMock';
import {
  LOCKED_SIP_WEB_SOCKET_SERVER_URL,
  dataForConnectionWithAuthorization,
  dataForConnectionWithoutAuthorization,
  dataForConnectionWithoutAuthorizationWithSipServerUrlChanged,
  dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged,
  oneWord,
  thirdWord,
  twoWord,
  uaConfigurationWithAuthorization,
  uaConfigurationWithoutAuthorization,
  uriWithName,
} from '../__fixtures__/connectToServer';
import hasValidUri from '../__fixtures__/hasValidUri';
import { parseObjectWithoutUri } from '../__tests-utils__/parseObject';
import resolveConnectToServer from '../connectToServer';

describe('connectToServer', () => {
  let connectToServer: ReturnType<typeof resolveConnectToServer>;
  let sipConnector: SipConnector;
  let disconnectedMock: jest.Mock<any, any>;

  beforeEach(() => {
    jest.resetModules();

    sipConnector = doMockSIPconnector();

    disconnectedMock = jest.fn();

    const { disconnect: disconnectOrigin, connect: connectOrigin } = sipConnector;

    sipConnector.disconnect = () => {
      disconnectedMock();

      return disconnectOrigin();
    };

    sipConnector.connect = (data) => {
      if (data.sipWebSocketServerURL === LOCKED_SIP_WEB_SOCKET_SERVER_URL) {
        const error = new Error('failed wss-request');

        return Promise.reject(error);
      }

      return connectOrigin(data);
    };

    connectToServer = resolveConnectToServer(sipConnector);
  });

  it('registered', () => {
    return connectToServer(dataForConnectionWithAuthorization).then(() => {
      expect(sipConnector.ua!.configuration).toEqual(uaConfigurationWithAuthorization);
    });
  });

  it('registered async', () => {
    return Promise.all([
      connectToServer({ ...dataForConnectionWithAuthorization, name: oneWord }),
      connectToServer({ ...dataForConnectionWithAuthorization, name: twoWord }),
      connectToServer({ ...dataForConnectionWithAuthorization, name: thirdWord }),
    ]).then(() => {
      expect(sipConnector.ua!.configuration).toEqual({
        ...uaConfigurationWithAuthorization,
        uri: uriWithName(thirdWord),
      });
    });
  });

  it('registered sync', () => {
    return connectToServer({ ...dataForConnectionWithAuthorization, name: oneWord })
      .then(() => {
        return connectToServer({ ...dataForConnectionWithAuthorization, name: twoWord });
      })
      .then(() => {
        return connectToServer({ ...dataForConnectionWithAuthorization, name: thirdWord });
      })
      .then(() => {
        expect(sipConnector.ua!.configuration).toEqual({
          ...uaConfigurationWithAuthorization,
          uri: uriWithName(thirdWord),
        });
      });
  });

  it('unregistered', () => {
    return connectToServer(dataForConnectionWithoutAuthorization).then(() => {
      expect(hasValidUri(sipConnector.ua!.configuration.uri)).toBe(true);
      expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
        uaConfigurationWithoutAuthorization,
      );
    });
  });

  it('unregistered async', () => {
    return Promise.all([
      connectToServer(dataForConnectionWithAuthorization),
      connectToServer(dataForConnectionWithoutAuthorization),
    ]).then(() => {
      expect(hasValidUri(sipConnector.ua!.configuration.uri)).toBe(true);
      expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
        uaConfigurationWithoutAuthorization,
      );
    });
  });

  it('change sipServerUrl', () => {
    return connectToServer(dataForConnectionWithoutAuthorization).then(() => {
      return connectToServer(dataForConnectionWithoutAuthorizationWithSipServerUrlChanged).then(
        () => {
          expect(
            hasValidUri(
              sipConnector.ua!.configuration.uri,
              dataForConnectionWithoutAuthorizationWithSipServerUrlChanged.sipServerUrl,
            ),
          ).toBe(true);
          expect(parseObjectWithoutUri(sipConnector.ua!.configuration)).toEqual(
            uaConfigurationWithoutAuthorization,
          );
        },
      );
    });
  });

  it('change sipWebSocketServerUrl', () => {
    return connectToServer(dataForConnectionWithoutAuthorization).then(() => {
      return connectToServer(
        dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged,
      ).then(() => {
        expect(sipConnector.socket!.url).toEqual(
          dataForConnectionWithoutAuthorizationWithSipWebSocketServerUrlChanged.sipWebSocketServerURL,
        );
      });
    });
  });

  it('should be closed web-socket connection when wss-request has failed and isDisconnectOnFail is true', async () => {
    expect.assertions(2);

    return connectToServer({
      ...dataForConnectionWithAuthorization,
      sipWebSocketServerURL: LOCKED_SIP_WEB_SOCKET_SERVER_URL,
      isDisconnectOnFail: true,
    }).catch((error: Error) => {
      expect(disconnectedMock).toHaveBeenCalledTimes(1);
      expect(error).toBeDefined();
    });
  });

  it('should not be closed web-socket connection when wss-request has failed and isDisconnectOnFail is false', async () => {
    expect.assertions(2);

    return connectToServer({
      ...dataForConnectionWithAuthorization,
      sipWebSocketServerURL: LOCKED_SIP_WEB_SOCKET_SERVER_URL,
    }).catch((error: Error) => {
      expect(disconnectedMock).toHaveBeenCalledTimes(0);
      expect(error).toBeDefined();
    });
  });
});
