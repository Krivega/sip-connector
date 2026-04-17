import type { EndEvent } from '@krivega/jssip';

export { FakeCallManager } from './FakeCallManager';
export { FakeConnectionManager } from './FakeConnectionManager';

export const makeNetworkFailedEndEvent = (cause: string): EndEvent => {
  return {
    cause,
    originator: 'remote',
  } as EndEvent;
};
