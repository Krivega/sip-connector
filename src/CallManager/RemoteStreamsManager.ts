type TStreamGroup = {
  participantId: string;
  groupId: string;
  stream: MediaStream;
  trackIds: Set<string>;
};

type TMediaTrackSettingsWithMsid = MediaTrackSettings & {
  msid?: string;
};

const getSettingsWithMsid = (track: MediaStreamTrack): TMediaTrackSettingsWithMsid | undefined => {
  return track.getSettings() as TMediaTrackSettingsWithMsid | undefined;
};

const resolveStreamGroupId = (track: MediaStreamTrack, overrideStreamId?: string): string => {
  const settings = getSettingsWithMsid(track);
  let streamId = overrideStreamId;

  streamId ??= track.label;

  let resolvedStreamId = settings?.msid;

  resolvedStreamId ??= streamId;
  resolvedStreamId ??= track.id;

  return resolvedStreamId;
};

const resolveParticipantId = (track: MediaStreamTrack, overrideParticipant?: string): string => {
  const settings = getSettingsWithMsid(track);
  let candidate = overrideParticipant;

  candidate ??= settings?.msid;
  candidate ??= track.label;

  const normalizedCandidate = candidate && candidate.length > 0 ? candidate : undefined;

  return normalizedCandidate ?? track.id;
};

export class RemoteStreamsManager {
  private readonly participantGroups = new Map<string, Map<string, TStreamGroup>>();

  private readonly trackToGroup = new Map<string, { participantId: string; groupId: string }>();

  private readonly trackDisposers = new Map<string, () => void>();

  public get mainStream(): MediaStream | undefined {
    const streams: (MediaStream | undefined)[] = this.getStreams();
    const [mainStream] = streams;

    return mainStream;
  }

  public reset() {
    this.participantGroups.clear();
    this.trackToGroup.clear();
    this.trackDisposers.forEach((dispose) => {
      dispose();
    });
    this.trackDisposers.clear();
  }

  public addTrack(
    track: MediaStreamTrack,
    {
      onRemoved,
      streamHint,
    }: {
      streamHint?: string;
      onRemoved?: ({
        trackId,
        participantId,
      }: {
        trackId: string;
        isRemovedStream: boolean;
        participantId: string;
      }) => void;
    } = {},
  ):
    | {
        isAddedTrack: true;
        isAddedStream: boolean;
        participantId: string;
      }
    | { isAddedTrack: false; isAddedStream: false } {
    const participantId = resolveParticipantId(track, streamHint);
    const groupId = resolveStreamGroupId(track, streamHint);

    if (this.trackToGroup.has(track.id)) {
      return { isAddedTrack: false, isAddedStream: false };
    }

    const participantGroups = this.getParticipantGroups(participantId);
    const existingGroup = participantGroups.get(groupId);
    const isAddedStream = !existingGroup;

    let group = existingGroup;

    if (!group) {
      group = {
        participantId,
        groupId,
        stream: new MediaStream(),
        trackIds: new Set(),
      };
      participantGroups.set(groupId, group);
    }

    group.stream.addTrack(track);
    group.trackIds.add(track.id);

    this.trackToGroup.set(track.id, { participantId, groupId });

    const handleEnded = () => {
      this.disposeTrackListener(track.id);

      const removed = this.removeTrack(track.id);

      if (removed.isRemovedTrack) {
        onRemoved?.({
          participantId,
          trackId: track.id,
          isRemovedStream: removed.isRemovedStream,
        });
      }
    };

    track.addEventListener('ended', handleEnded);
    this.trackDisposers.set(track.id, () => {
      track.removeEventListener('ended', handleEnded);
    });

    return { isAddedTrack: true, isAddedStream, participantId };
  }

  public removeTrack(trackId: string): { isRemovedTrack: boolean; isRemovedStream: boolean } {
    this.disposeTrackListener(trackId);

    const groupInfo = this.trackToGroup.get(trackId);

    if (!groupInfo) {
      return { isRemovedTrack: false, isRemovedStream: false };
    }

    const { participantId, groupId } = groupInfo;
    const participantGroups = this.participantGroups.get(participantId);
    const group = participantGroups?.get(groupId);

    if (!group) {
      this.trackToGroup.delete(trackId);

      return { isRemovedTrack: false, isRemovedStream: false };
    }

    const trackToRemove = group.stream.getTracks().find((streamTrack) => {
      return streamTrack.id === trackId;
    });

    if (trackToRemove) {
      group.stream.removeTrack(trackToRemove);
    }

    group.trackIds.delete(trackId);
    this.trackToGroup.delete(trackId);

    const isRemovedStream = group.trackIds.size === 0;

    if (isRemovedStream) {
      participantGroups?.delete(groupId);

      if (participantGroups?.size === 0) {
        this.participantGroups.delete(participantId);
      }
    }

    return { isRemovedTrack: true, isRemovedStream };
  }

  public removeStaleTracks(participantId: string, keepTrackIds: string[]): boolean {
    const participantGroups = this.participantGroups.get(participantId);

    if (!participantGroups) {
      return false;
    }

    let didChange = false;

    const groupsSnapshot = [...participantGroups.values()];

    groupsSnapshot.forEach((group) => {
      const staleTrackIds = [...group.trackIds].filter((trackId) => {
        return !keepTrackIds.includes(trackId);
      });

      staleTrackIds.forEach((staleTrackId) => {
        const removed = this.removeTrack(staleTrackId);

        didChange ||= removed.isRemovedTrack;
      });
    });

    return didChange;
  }

  public getStreams(participantId?: string): MediaStream[] {
    if (participantId !== undefined) {
      const participantGroups = this.participantGroups.get(participantId);

      if (!participantGroups) {
        return [];
      }

      return [...participantGroups.values()].map((group) => {
        return group.stream;
      });
    }

    return [...this.participantGroups.values()]
      .flatMap((groups) => {
        return [...groups.values()];
      })
      .map((group) => {
        return group.stream;
      });
  }

  private disposeTrackListener(trackId: string) {
    const disposer = this.trackDisposers.get(trackId);

    if (!disposer) {
      return;
    }

    disposer();
    this.trackDisposers.delete(trackId);
  }

  private getParticipantGroups(participantId: string) {
    const existingGroups = this.participantGroups.get(participantId);

    if (existingGroups) {
      return existingGroups;
    }

    const newGroups = new Map<string, TStreamGroup>();

    this.participantGroups.set(participantId, newGroups);

    return newGroups;
  }
}
