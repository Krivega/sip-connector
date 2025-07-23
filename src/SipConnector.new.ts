import { ApiManager } from './ApiManager';
import { CallManager } from './CallManager';
import { ConnectionManager } from './ConnectionManager';
import { IncomingCallManager } from './IncomingCallManager';
import { PresentationManager } from './PresentationManager';
import type { TJsSIP } from './types';

class SipConnector {
  private readonly connectionManager: ConnectionManager;

  private readonly callManager: CallManager;

  private readonly apiManager: ApiManager;

  private readonly incomingCallManager: IncomingCallManager;

  private readonly presentationManager: PresentationManager;

  public constructor({ JsSIP }: { JsSIP: TJsSIP }) {
    this.connectionManager = new ConnectionManager({ JsSIP });
    this.callManager = new CallManager();
    this.apiManager = new ApiManager({
      connectionManager: this.connectionManager,
      callManager: this.callManager,
    });
    this.incomingCallManager = new IncomingCallManager(this.connectionManager);
    this.presentationManager = new PresentationManager({
      callManager: this.callManager,
    });
  }
}

export default SipConnector;
