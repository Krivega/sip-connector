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
  } = {}
) => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let reBalance = () => {};
  const handleMainCamControl = (headers: {
    mainCam: EEventsMainCAM;
    resolutionMainCam?: string;
  }) => {
    reBalance = () => {
      const { mainCam, resolutionMainCam } = headers;
      const { connection } = sipConnector;

      if (!connection || mainCam === undefined) {
        return;
      }

      balance({
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

  return { subscribe, unsubscribe, reBalance };
};

export default resolveVideoSendingBalancer;
