import type { EEventsMainCAM } from '../ApiManager';
import { debug } from '../logger';
import type { SipConnector } from '../SipConnector';
import balance from './balance';
import type { TOnSetParameters } from './setEncodingsToSender';

const resolveVideoSendingBalancer = (
  sipConnector: SipConnector,
  {
    ignoreForCodec,
    onSetParameters,
  }: {
    ignoreForCodec?: string;
    onSetParameters?: TOnSetParameters;
  } = {},
) => {
  const balanceByTrack = async () => {
    const { connection } = sipConnector;

    if (!connection) {
      throw new Error('connection is not exist');
    }

    return balance({
      connection,
      onSetParameters,
      ignoreForCodec,
    });
  };

  let reBalance = balanceByTrack;

  const handleMainCamControl = (headers: {
    mainCam: EEventsMainCAM;
    resolutionMainCam?: string;
  }) => {
    reBalance = async () => {
      const { mainCam, resolutionMainCam } = headers;

      const { connection } = sipConnector;

      if (!connection) {
        throw new Error('connection is not exist');
      }

      return balance({
        mainCam,
        resolutionMainCam,
        connection,
        onSetParameters,
        ignoreForCodec,
      });
    };

    reBalance().catch(debug);
  };

  const subscribe = () => {
    sipConnector.on('api:main-cam-control', handleMainCamControl);
  };

  const unsubscribe = () => {
    sipConnector.off('api:main-cam-control', handleMainCamControl);
  };

  return {
    subscribe,
    unsubscribe,
    balanceByTrack,
    resetMainCamControl() {
      reBalance = balanceByTrack;
    },
    async reBalance() {
      return reBalance();
    },
  };
};

export default resolveVideoSendingBalancer;
