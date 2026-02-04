import { ApiManager } from '@/ApiManager';
import { CallManager } from '@/CallManager';
import { ConnectionManager } from '@/ConnectionManager';
import { ContentedStreamManager } from '@/ContentedStreamManager';
import jssip from './jssip.mock';

import type { TJsSIP } from '@/types';

export const createManagers = () => {
  const contentedStreamManager = new ContentedStreamManager();
  const callManager = new CallManager(contentedStreamManager);

  const connectionManager = new ConnectionManager({ JsSIP: jssip as unknown as TJsSIP });
  const apiManager = new ApiManager();

  apiManager.subscribe({
    connectionManager,
    callManager,
  });

  callManager.subscribeToApiEvents(apiManager);

  return {
    connectionManager,
    contentedStreamManager,
    callManager,
    apiManager,
  };
};
