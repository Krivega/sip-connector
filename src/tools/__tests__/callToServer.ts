/// <reference types="jest" />
import doMockSIPconnector from '../../doMock';
import dataCall, {
  dataCallPurgatory,
  onEnterConference,
  onEnterPurgatory,
  peerConnectionFromData,
} from '../__fixtures__/call';
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
    expect.assertions(3);

    return connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return call(dataCall);
      })
      .then((peerConnection) => {
        // @ts-expect-error
        expect(parseObject(peerConnection._receivers)).toEqual(
          parseObject(peerConnectionFromData._receivers),
        );
        expect(onEnterPurgatory).toHaveBeenCalledTimes(0);
        expect(onEnterConference).toHaveBeenCalledTimes(1);
      });
  });

  it('chould call correct handler after purgatory call', async () => {
    expect.assertions(2);

    return connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return call(dataCallPurgatory);
      })
      .then(() => {
        expect(onEnterPurgatory).toHaveBeenCalledTimes(1);
        expect(onEnterConference).toHaveBeenCalledTimes(0);
      });
  });
});
