import type SipConnector from '../SipConnector';
import type { EEventsMainCAM } from '../types';
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

  const handleMainCamControl = async (headers: {
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

    return reBalance();
  };

  const subscribe = () => {
    sipConnector.onSession('main-cam-control', handleMainCamControl);
  };

  const unsubscribe = () => {
    sipConnector.offSession('main-cam-control', handleMainCamControl);
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
