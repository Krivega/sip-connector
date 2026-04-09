const PRESENTATION_CALL_HEADER = 'x-vinteo-presentation-call: yes';

const hasPresentationCall = (extraHeaders?: string[]): boolean => {
  if (!Array.isArray(extraHeaders)) {
    return false;
  }

  return extraHeaders.some((header) => {
    return header.trim().toLowerCase() === PRESENTATION_CALL_HEADER;
  });
};

export default hasPresentationCall;
