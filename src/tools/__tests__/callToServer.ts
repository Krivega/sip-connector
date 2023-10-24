import doMockSIPconnector from '../../__fixtures__/doMock';
import dataCall, { peerConnectionFromData } from '../__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '../__fixtures__/connectToServer';
import parseObject from '../__tests-utils__/parseObject';
import resolveCall from '../callToServer';
import resolveConnectToServer from '../connectToServer';

describe('callToServer', () => {
  const sipConnector = doMockSIPconnector();
  let connectToServer: ReturnType<typeof resolveConnectToServer>;
  let call: ReturnType<typeof resolveCall>;

  beforeEach(() => {
    jest.resetModules();

    connectToServer = resolveConnectToServer(sipConnector);
    call = resolveCall(sipConnector);
  });

  it('check call', async () => {
    expect.assertions(1);

    return connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return call(dataCall);
      })
      .then((peerConnection) => {
        // @ts-expect-error
        expect(parseObject(peerConnection._receivers)).toEqual(
          parseObject(peerConnectionFromData._receivers),
        );
      });
  });
});
