/// <reference types="jest" />
import { doMockSipConnector } from '../../doMock';
import dataCall, {
  dataCallPurgatory,
  onEnterConference,
  onEnterPurgatory,
  peerConnectionFromData,
} from '../../tools/__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '../../tools/__fixtures__/connectToServer';
import parseObject from '../../tools/__tests-utils__/parseObject';
import SipConnectorFacade from '../SipConnectorFacade';

describe('callToServer', () => {
  const sipConnector = doMockSipConnector();
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.resetModules();

    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  it('check call', async () => {
    expect.assertions(3);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      })
      .then((peerConnection) => {
        expect(parseObject(peerConnection.getReceivers())).toEqual(
          parseObject(peerConnectionFromData.getReceivers()),
        );
        expect(onEnterPurgatory).toHaveBeenCalledTimes(0);
        expect(onEnterConference).toHaveBeenCalledTimes(1);
      });
  });

  it('chould call correct handler after purgatory call', async () => {
    expect.assertions(2);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCallPurgatory);
      })
      .then(() => {
        expect(onEnterPurgatory).toHaveBeenCalledTimes(1);
        expect(onEnterConference).toHaveBeenCalledTimes(0);
      });
  });
});
