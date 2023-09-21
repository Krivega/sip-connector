export const PURGATORY_CONFERENCE_NUMBER = 'purgatory' as const;

const hasPurgatory = (room?: string) => {
  return room === PURGATORY_CONFERENCE_NUMBER;
};

export default hasPurgatory;
