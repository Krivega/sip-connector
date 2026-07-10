import PresentationSessionMock from './PresentationSessionMock';
import UA from './UA.mock';

import type { TEventHandlers } from './BaseSession.mock';
import type RTCSessionMock from './RTCSessionMock';

class PresentationUAMock extends UA {
  public call = jest.fn(
    (
      url: string,
      parameters: { mediaStream: MediaStream; eventHandlers: TEventHandlers },
    ): RTCSessionMock => {
      const { mediaStream, eventHandlers } = parameters;
      const session = new PresentationSessionMock({ eventHandlers, originator: 'local' });

      session.connect(url, { mediaStream });

      return session;
    },
  );
}

export default PresentationUAMock;
