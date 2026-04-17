import { C as JsSIP_C } from '@krivega/jssip';

import { createNetworkFailurePolicy, defaultIsNetworkFailure } from '../NetworkFailurePolicy';

import type { EndEvent } from '@krivega/jssip';

const makeEvent = (partial: Partial<EndEvent>): EndEvent => {
  return {
    cause: '',
    originator: 'remote',
    ...partial,
  } as EndEvent;
};

describe('NetworkFailurePolicy', () => {
  describe('defaultIsNetworkFailure', () => {
    it('trat local originator as non-network regardless of cause', () => {
      expect(
        defaultIsNetworkFailure(
          makeEvent({ cause: JsSIP_C.causes.CONNECTION_ERROR, originator: 'local' }),
        ),
      ).toBe(false);
    });

    it.each([
      JsSIP_C.causes.CONNECTION_ERROR,
      JsSIP_C.causes.REQUEST_TIMEOUT,
      JsSIP_C.causes.RTP_TIMEOUT,
      JsSIP_C.causes.ADDRESS_INCOMPLETE,
    ])('recognizes transport cause as network failure: %s', (cause) => {
      expect(defaultIsNetworkFailure(makeEvent({ cause, originator: 'remote' }))).toBe(true);
    });

    it('treats INTERNAL_ERROR from system as network failure', () => {
      expect(
        defaultIsNetworkFailure(
          makeEvent({ cause: JsSIP_C.causes.INTERNAL_ERROR, originator: 'system' }),
        ),
      ).toBe(true);
    });

    it('treats INTERNAL_ERROR from remote as non-network failure', () => {
      expect(
        defaultIsNetworkFailure(
          makeEvent({ cause: JsSIP_C.causes.INTERNAL_ERROR, originator: 'remote' }),
        ),
      ).toBe(false);
    });

    it('treats unknown business cause as non-network', () => {
      expect(
        defaultIsNetworkFailure(makeEvent({ cause: JsSIP_C.causes.BUSY, originator: 'remote' })),
      ).toBe(false);
    });
  });

  describe('createNetworkFailurePolicy', () => {
    it('uses custom predicate when provided', () => {
      const custom = jest.fn().mockReturnValue(true);
      const policy = createNetworkFailurePolicy(custom);

      const event = makeEvent({ cause: JsSIP_C.causes.BUSY });

      expect(policy(event)).toBe(true);
      expect(custom).toHaveBeenCalledWith(event);
    });

    it('falls back to default predicate when undefined', () => {
      const policy = createNetworkFailurePolicy(undefined);

      expect(
        policy(makeEvent({ cause: JsSIP_C.causes.REQUEST_TIMEOUT, originator: 'remote' })),
      ).toBe(true);
    });
  });
});
