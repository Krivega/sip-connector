import type SipConnector from '../SipConnector';
import type { EEventsMainCAM } from '../SipConnector';
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
  const balanceByTrack = () => {
    const { connection } = sipConnector;

    if (!connection) {
      return Promise.reject(new Error('connection is not exist'));
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
    reBalance = () => {
      const { mainCam, resolutionMainCam } = headers;
      const { connection } = sipConnector;

      if (!connection) {
        return Promise.reject(new Error('connection is not exist'));
      }

      return balance({
        mainCam,
        resolutionMainCam,
        connection,
        onSetParameters,
        ignoreForCodec,
      });
    };

    reBalance();
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
    reBalance() {
      return reBalance();
    },
  };
};

export default resolveVideoSendingBalancer;
