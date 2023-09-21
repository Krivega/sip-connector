import delayPromise from 'promise-delay';
import doMockSIPconnector from '../../__fixtures__/doMock';
import dataCall from '../__fixtures__/call';
import { dataForConnectionWithoutAuthorization } from '../__fixtures__/connectToServer';
import resolveCall from '../callToServer';
import resolveConnectToServer from '../connectToServer';
import sendDTMFAccumulated from '../sendDTMFAccumulated';

describe('sendDTMFAccumulated', () => {
  const DTMF_SENDING_DELAY = 100;
  const dtmf = '1234#';
  const sipConnector = doMockSIPconnector();
  let connectToServer: ReturnType<typeof resolveConnectToServer>;
  let call: ReturnType<typeof resolveCall>;

  beforeEach(() => {
    jest.resetModules();

    connectToServer = resolveConnectToServer(sipConnector);
    call = resolveCall(sipConnector);
  });

  it('should be sent dtmf from sendDTMFAccumulated', () => {
    expect.assertions(5);

    return connectToServer(dataForConnectionWithoutAuthorization)
      .then(() => {
        // @ts-ignore
        return call(dataCall);
      })
      .then(async () => {
        sipConnector.onSession('newDTMF', ({ originator }) => {
          expect(originator).toEqual('local');
        });

        const sendKey = (key: string): Promise<void> => {
          return sipConnector.sendDTMF(key);
        };

        sendDTMFAccumulated({ accumulatedKeys: dtmf, sendKey });

        await delayPromise(DTMF_SENDING_DELAY);
      });
  });
});
