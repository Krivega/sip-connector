import { ApiManager } from '@/ApiManager';
import { CallManager } from '@/CallManager';
import { ConferenceStateManager } from '@/ConferenceStateManager';
import { ConnectionManager } from '@/ConnectionManager';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import jssip from './jssip.mock';

import type { TJsSIP } from '@/types';

export const createManagers = () => {
  const conferenceStateManager = new ConferenceStateManager();
  const contentedStreamManager = new ContentedStreamManager();
  const callManager = new CallManager(conferenceStateManager, contentedStreamManager);

  const connectionManager = new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP });
  const apiManager = new ApiManager();

  apiManager.subscribe({
    connectionManager,
    callManager,
  });

  return {
    conferenceStateManager,
    connectionManager,
    contentedStreamManager,
    callManager,
    apiManager,
  };
};
