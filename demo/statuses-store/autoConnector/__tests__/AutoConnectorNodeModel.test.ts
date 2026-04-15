import { EAutoConnectorState as EAutoConnectorStatus } from '@/AutoConnectorManager/AutoConnectorStateMachine';
import {
  AutoConnectorNodeModel,
  INITIAL_AUTO_CONNECTOR_NODE_SNAPSHOT,
} from '../AutoConnectorStatusesNode';

type TAutoConnectorSnapshot = Parameters<typeof AutoConnectorNodeModel.create>[0];
type TStateCase = {
  title: string;
  snapshot: TAutoConnectorSnapshot;
};

const createAutoConnectorNode = (
  snapshot: TAutoConnectorSnapshot = INITIAL_AUTO_CONNECTOR_NODE_SNAPSHOT,
) => {
  return AutoConnectorNodeModel.create(snapshot);
};

const stateCases: TStateCase[] = [
  {
    title: 'IDLE',
    snapshot: {
      state: EAutoConnectorStatus.IDLE,
      context: {
        stopReason: 'halted',
      },
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'DISCONNECTING',
    snapshot: {
      state: EAutoConnectorStatus.DISCONNECTING,
      context: {
        afterDisconnect: 'attempt',
        stopReason: 'cancelled',
      },
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'ATTEMPTING_GATE',
    snapshot: {
      state: EAutoConnectorStatus.ATTEMPTING_GATE,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'ATTEMPTING_CONNECT',
    snapshot: {
      state: EAutoConnectorStatus.ATTEMPTING_CONNECT,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'WAITING_BEFORE_RETRY',
    snapshot: {
      state: EAutoConnectorStatus.WAITING_BEFORE_RETRY,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'CONNECTED_MONITORING',
    snapshot: {
      state: EAutoConnectorStatus.CONNECTED_MONITORING,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'TELEPHONY_CHECKING',
    snapshot: {
      state: EAutoConnectorStatus.TELEPHONY_CHECKING,
      context: {},
    } as TAutoConnectorSnapshot,
  },
  {
    title: 'ERROR_TERMINAL',
    snapshot: {
      state: EAutoConnectorStatus.ERROR_TERMINAL,
      context: {
        stopReason: 'failed',
        lastError: new Error('auto connector failed'),
      },
    } as TAutoConnectorSnapshot,
  },
];

describe('AutoConnectorNodeModel', () => {
  it('maps initial snapshot to nodeValue', () => {
    const node = createAutoConnectorNode();

    expect(node.nodeValue).toEqual({
      state: EAutoConnectorStatus.IDLE,
      context: {},
    });
  });

  it.each(stateCases)('exposes nodeValue for $title', ({ snapshot }) => {
    const node = createAutoConnectorNode(snapshot);

    expect(node.nodeValue).toEqual(snapshot);
  });
});
