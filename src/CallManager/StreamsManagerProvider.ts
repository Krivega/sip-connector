import type { TContentedStreamStateInfo } from '@/ContentedStreamManager';
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

  public getActiveStreamsManagerTools({
    isSpectator,
    stateInfo,
  }: {
    isSpectator: boolean;
    stateInfo: TContentedStreamStateInfo;
  }): TStreamsManagerTools {
    if (isSpectator) {
      return this.getRecvRemoteStreamsManagerTools({ stateInfo });
    }

    return this.getMainRemoteStreamsManagerTools({ stateInfo });
  }

  public getMainRemoteStreamsManagerTools({
    stateInfo,
  }: {
    stateInfo: TContentedStreamStateInfo;
  }): TStreamsManagerTools {
    const manager = this.mainRemoteStreamsManager;
    const getRemoteStreams = (): ReturnType<TGetRemoteStreams> => {
      const streams = manager.getStreams();

      // Находим поток без треков с "dual" в label
      const mainStream = streams.find((stream) => {
        return !hasContendedStreamForParticipant(stream);
      });

      // Используем централизованное состояние вместо детекции по трекам
      const contentedStream = stateInfo.isAvailable
        ? streams.find((stream) => {
            return hasContendedStreamForParticipant(stream);
          })
        : undefined;

      return { mainStream, contentedStream };
    };

    return { manager, getRemoteStreams };
  }

  public getRecvRemoteStreamsManagerTools({
    stateInfo,
  }: {
    stateInfo: TContentedStreamStateInfo;
  }): TStreamsManagerTools {
    const manager = this.recvRemoteStreamsManager;
    const getRemoteStreams = (): ReturnType<TGetRemoteStreams> => {
      const mainStreams = manager.getStreams(PARTICIPANT_ID_SPECTATOR_MAIN_STREAM);

      const mainStream = mainStreams[0];

      return { mainStream, contentedStream: stateInfo.isAvailable ? mainStreams[1] : undefined };
    };

    return { manager, getRemoteStreams };
  }
}
