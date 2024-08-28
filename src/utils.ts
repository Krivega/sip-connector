export function resolveSipUrl(serverUrl: string): (string: string) => string {
  return (id: string): string => {
    return `sip:${id}@${serverUrl}`;
  };
}

const resolveRandomInt = (min: number, max: number) => {
  return () => {
    return Math.floor(Math.random() * (max - min)) + min;
  };
};
export const parseDisplayName = (displayName: string) => {
  return displayName.trim().replaceAll(' ', '_');
};
export const generateUserId = resolveRandomInt(100_000, 99_999_999);

export const hasVideoTracks = (remoteTracks: MediaStreamTrack[]): boolean => {
  const isVideoTracksExists = remoteTracks.some((remoteTrack: MediaStreamTrack): boolean => {
    const { kind } = remoteTrack;

    return kind === 'video';
  });

  return isVideoTracksExists;
};
