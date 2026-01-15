import type { RemoteStreamsManager } from './RemoteStreamsManager';
import type { TGetRemoteStreams, TStreamsManagerTools } from './types';

const PARTICIPANT_ID_SPECTATOR_MAIN_STREAM = 'default';
const LABEL_PARTICIPANT_CONTENTED_TRACK = 'dual';

const hasContendedStreamForParticipant = (stream: MediaStream) => {
  return [...stream.getTracks()].some((track) => {
    return track.label.includes(LABEL_PARTICIPANT_CONTENTED_TRACK);
  });
};

export class StreamsManagerProvider {
  private readonly mainRemoteStreamsManager: RemoteStreamsManager;

  private readonly recvRemoteStreamsManager: RemoteStreamsManager;

  public constructor(
    mainRemoteStreamsManager: RemoteStreamsManager,
    recvRemoteStreamsManager: RemoteStreamsManager,
  ) {
    this.mainRemoteStreamsManager = mainRemoteStreamsManager;
    this.recvRemoteStreamsManager = recvRemoteStreamsManager;
  }

  public getActiveStreamsManagerTools(isSpectator: boolean): TStreamsManagerTools {
    if (isSpectator) {
      return this.getRecvRemoteStreamsManagerTools();
    }

    return this.getMainRemoteStreamsManagerTools();
  }

  public getMainRemoteStreamsManagerTools(): TStreamsManagerTools {
    const manager = this.mainRemoteStreamsManager;
    const getRemoteStreams = (): ReturnType<TGetRemoteStreams> => {
      const streams = manager.getStreams();

      // Находим поток без треков с "dual" в label
      const mainStream = streams.find((stream) => {
        return !hasContendedStreamForParticipant(stream);
      });

      // Находим поток с треками, содержащими "dual" в label
      const contentedStream = streams.find((stream) => {
        return hasContendedStreamForParticipant(stream);
      });

      return { mainStream, contentedStream };
    };

    return { manager, getRemoteStreams };
  }

  public getRecvRemoteStreamsManagerTools(): TStreamsManagerTools {
    const manager = this.recvRemoteStreamsManager;
    const getRemoteStreams = (): ReturnType<TGetRemoteStreams> => {
      const mainStreams = manager.getStreams(PARTICIPANT_ID_SPECTATOR_MAIN_STREAM);

      const mainStream = mainStreams[0];

      return { mainStream, contentedStream: undefined };
    };

    return { manager, getRemoteStreams };
  }
}
