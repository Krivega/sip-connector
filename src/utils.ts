export function resolveSipUrl(serverUrl: string): (string) => string {
  return (id: string): string => {
    return `sip:${id}@${serverUrl}`;
  };
}

export function getRoomFromSipUrl(sipUrl: string): string {
  const matches = sipUrl.match(/[\d.]+/g);

  if (!matches) {
    throw new Error('wrong sip url');
  }

  return matches[0];
}

const resolveRandomInt = (min: number, max: number) => {
  return () => {
    return Math.floor(Math.random() * (max - min)) + min;
  };
};
export const parseDisplayName = (displayName: string) => {
  return displayName.trim().replace(/ /g, '_');
};
export const generateUserId = resolveRandomInt(100000, 99999999);

export const prepareMediaStream = (mediaStream: MediaStream): MediaStream => {
  const audioTracks = mediaStream.getAudioTracks();
  const videoTracks = mediaStream.getVideoTracks();
  const tracks = [...audioTracks, ...videoTracks];
  const newStream = new MediaStream(tracks);

  newStream.getTracks = () => {
    return [...newStream.getAudioTracks(), ...newStream.getVideoTracks()]; // for garante audio first order
  };

  return newStream;
};

export const hasVideoTracks = (remoteTracks: MediaStreamTrack[]): boolean => {
  const isVideoTracksExists = remoteTracks.some((remoteTrack: MediaStreamTrack): boolean => {
    const { kind } = remoteTrack;

    return kind === 'video';
  });

  return isVideoTracksExists;
};
