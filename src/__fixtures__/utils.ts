export function getRoomFromSipUrl(sipUrl: string): string {
  const matches = sipUrl.match(/[\d.]+/g);

  if (!matches) {
    throw new Error('wrong sip url');
  }

  return matches[0];
}
