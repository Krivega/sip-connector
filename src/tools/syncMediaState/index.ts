import type SipConnector from '../../SipConnector';
import resolveOnStartMainCam from './resolveOnStartMainCam';
import resolveOnStartMic from './resolveOnStartMic';
import resolveOnStopMainCam from './resolveOnStopMainCam';
import resolveOnStopMic from './resolveOnStopMic';

type THandlers = {
  onStartMainCamForced: () => void;
  onStartMainCamNotForced: () => void;
  onStopMainCamForced: () => void;
  onStopMainCamNotForced: () => void;
  onStartMicForced: () => void;
  onStartMicNotForced: () => void;
  onStopMicForced: () => void;
  onStopMicNotForced: () => void;
};

const createSyncMediaState = ({ sipConnector }: { sipConnector: SipConnector }) => {
  const resolveWhenElseSyncForced = (whenSyncForced: () => void, whenNotSyncForced: () => void) => {
    return ({ isSyncForced }: { isSyncForced?: boolean }) => {
      if (isSyncForced === true) {
        whenSyncForced();

        return;
      }

      whenNotSyncForced();
    };
  };

  const subscribeStartMainCam = resolveOnStartMainCam(sipConnector);
  const subscribeStopMainCam = resolveOnStopMainCam(sipConnector);
  const subscribeStartMic = resolveOnStartMic(sipConnector);
  const subscribeStopMic = resolveOnStopMic(sipConnector);

  let unsubscribeStartMainCam: (() => void) | undefined;
  let unsubscribeStopMainCam: (() => void) | undefined;
  let unsubscribeStartMic: (() => void) | undefined;
  let unsubscribeStopMic: (() => void) | undefined;

  const subscribeSyncCommands = ({
    onStartMainCamForced,
    onStartMainCamNotForced,
    onStopMainCamForced,
    onStopMainCamNotForced,
    onStartMicForced,
    onStartMicNotForced,
    onStopMicForced,
    onStopMicNotForced,
  }: THandlers) => {
    const handleStartMainCam = resolveWhenElseSyncForced(
      onStartMainCamForced,
      onStartMainCamNotForced,
    );

    unsubscribeStartMainCam = subscribeStartMainCam(handleStartMainCam);

    const handleStopMainCam = resolveWhenElseSyncForced(
      onStopMainCamForced,
      onStopMainCamNotForced,
    );

    unsubscribeStopMainCam = subscribeStopMainCam(handleStopMainCam);

    const handleStartMic = resolveWhenElseSyncForced(onStartMicForced, onStartMicNotForced);

    unsubscribeStartMic = subscribeStartMic(handleStartMic);

    const handleStopMic = resolveWhenElseSyncForced(onStopMicForced, onStopMicNotForced);

    unsubscribeStopMic = subscribeStopMic(handleStopMic);
  };

  const unsubscribeSyncCommands = () => {
    unsubscribeStartMainCam?.();
    unsubscribeStopMainCam?.();
    unsubscribeStartMic?.();
    unsubscribeStopMic?.();
  };

  const start = (handlers: THandlers) => {
    subscribeSyncCommands(handlers);
  };

  const stop = () => {
    unsubscribeSyncCommands();
  };

  return {
    start,
    stop,
  };
};

export default createSyncMediaState;
