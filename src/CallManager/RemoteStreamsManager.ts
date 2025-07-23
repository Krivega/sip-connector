// Класс для управления remoteStreams и генерации MediaStream
export class RemoteStreamsManager {
  private remoteStreams: Record<string, MediaStream> = {};

  public reset() {
    this.remoteStreams = {};
  }

  public generateStream(videoTrack: MediaStreamTrack, audioTrack?: MediaStreamTrack): MediaStream {
    const { id } = videoTrack;
    const remoteStream: MediaStream = this.remoteStreams[id] ?? new MediaStream();

    if (audioTrack) {
      remoteStream.addTrack(audioTrack);
    }

    remoteStream.addTrack(videoTrack);
    this.remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  public generateAudioStream(audioTrack: MediaStreamTrack): MediaStream {
    const { id } = audioTrack;
    const remoteStream = this.remoteStreams[id] ?? new MediaStream();

    remoteStream.addTrack(audioTrack);
    this.remoteStreams[id] = remoteStream;

    return remoteStream;
  }

  public generateStreams(remoteTracks: MediaStreamTrack[]): MediaStream[] {
    const remoteStreams: MediaStream[] = [];

    remoteTracks.forEach((track, index) => {
      if (track.kind === 'audio') {
        return;
      }

      const videoTrack = track;
      const previousTrack = remoteTracks[index - 1] as MediaStreamTrack | undefined;
      let audioTrack;

      if (previousTrack?.kind === 'audio') {
        audioTrack = previousTrack;
      }

      const remoteStream = this.generateStream(videoTrack, audioTrack);

      remoteStreams.push(remoteStream);
    });

    return remoteStreams;
  }

  public generateAudioStreams(remoteTracks: MediaStreamTrack[]): MediaStream[] {
    return remoteTracks.map((remoteTrack) => {
      return this.generateAudioStream(remoteTrack);
    });
  }
}
