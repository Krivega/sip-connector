import { isValueConferenceParticipantTokenIssued } from '../events';

describe('isValueConferenceParticipantTokenIssued', () => {
  it('should return true for a valid conference participant token issued', () => {
    expect(
      isValueConferenceParticipantTokenIssued({
        conference: '123',
        participant: '456',
        jwt: '789',
      }),
    ).toBe(true);
  });

  it('should return false for a non-object input', () => {
    expect(isValueConferenceParticipantTokenIssued(undefined)).toBe(false);
    expect(isValueConferenceParticipantTokenIssued('invalid')).toBe(false);
    expect(isValueConferenceParticipantTokenIssued(123)).toBe(false);
    expect(isValueConferenceParticipantTokenIssued([])).toBe(false);
  });

  it('should return false for an invalid conference participant token issued (empty values)', () => {
    expect(
      isValueConferenceParticipantTokenIssued({
        conference: '',
        participant: '456',
        jwt: '789',
      }),
    ).toBe(false);

    expect(
      isValueConferenceParticipantTokenIssued({
        conference: '123',
        participant: '   ',
        jwt: '789',
      }),
    ).toBe(false);

    expect(
      isValueConferenceParticipantTokenIssued({
        conference: '123',
        participant: '456',
        jwt: '',
      }),
    ).toBe(false);

    expect(
      isValueConferenceParticipantTokenIssued({
        conference: '123',
        participant: '456',
        jwt: '   ',
      }),
    ).toBe(false);
  });

  it('should return false for an invalid conference participant token issued with undefined conference', () => {
    expect(
      isValueConferenceParticipantTokenIssued({
        conference: undefined,
        participant: '456',
        jwt: '789',
      }),
    ).toBe(false);
  });

  it('should return false for an invalid conference participant token issued with undefined participant', () => {
    expect(
      isValueConferenceParticipantTokenIssued({
        conference: '123',
        participant: '456',
        jwt: undefined,
      }),
    ).toBe(false);
  });

  it('should return false for an invalid conference participant token issued with undefined jwt', () => {
    expect(
      isValueConferenceParticipantTokenIssued({
        conference: '123',
        participant: undefined,
        jwt: '789',
      }),
    ).toBe(false);
  });

  it('should return false for an object without required fields', () => {
    expect(isValueConferenceParticipantTokenIssued({})).toBe(false);
  });
});
