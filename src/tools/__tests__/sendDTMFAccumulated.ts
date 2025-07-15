/// <reference types="jest" />
import delayPromise from '../../__fixtures__/delayPromise';
import { doMockSipConnector } from '../../doMock';
import { SipConnectorFacade } from '../../SipConnectorFacade';
import dataCall from '../__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '../__fixtures__/connectToServer';
import sendDTMFAccumulated from '../sendDTMFAccumulated';

describe('sendDTMFAccumulated', () => {
  const DTMF_SENDING_DELAY = 100;
  const dtmf = '1234#';
  const sipConnector = doMockSipConnector();
  let sipConnectorFacade: SipConnectorFacade;

  beforeEach(() => {
    jest.resetModules();

    sipConnectorFacade = new SipConnectorFacade(sipConnector);
  });

  it('should be sent dtmf from sendDTMFAccumulated', async () => {
    expect.assertions(5);

    return sipConnectorFacade
      .connectToServer(dataForConnectionWithoutAuthorization)
      .then(async () => {
        return sipConnectorFacade.callToServer(dataCall);
      })
      .then(async () => {
        sipConnector.onSession('newDTMF', ({ originator }: { originator: string }) => {
          expect(originator).toEqual('local');
        });

        const sendKey = async (key: string): Promise<void> => {
          return sipConnector.sendDTMF(key);
        };

        await sendDTMFAccumulated({ accumulatedKeys: dtmf, sendKey });

        await delayPromise(DTMF_SENDING_DELAY);
      });
  });
});
