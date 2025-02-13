export function getRoomFromSipUrl(sipUrl: string): string {
  const matches = sipUrl.match(/(purgatory)|[\d.]+/g);

  if (!matches) {
    throw new Error('wrong sip url');
  }

  return matches[0];
}
