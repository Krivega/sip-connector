export const PURGATORY_CONFERENCE_NUMBER = 'purgatory';

const hasPurgatory = (room?: string) => {
  return room === PURGATORY_CONFERENCE_NUMBER;
};

export default hasPurgatory;
