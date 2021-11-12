export const findVideoSender = (senders?: RTCRtpSender[]): RTCRtpSender | undefined => {
  if (senders) {
    return senders.find((sender) => {
      return sender?.track?.kind === 'video';
    });
  }

  return undefined;
};

const statsReportToArray = (results: RTCStatsReport) => {
  return [...results.keys()].map((key) => {
    return results.get(key);
  });
};

const findInResultByType = (results: RTCStatsReport, type: string) => {
  return statsReportToArray(results).find((value) => {
    return value.type === type;
  });
};

const getCodecFromPeerConnection = (
  senders?: RTCRtpSender[]
): Promise<string | undefined> | Promise<void> => {
  if (senders) {
    const sender = findVideoSender(senders);

    if (!sender) {
      return Promise.resolve(undefined);
    }

    return sender?.getStats().then((stats: RTCStatsReport) => {
      const codec = findInResultByType(stats, 'codec');

      return codec?.mimeType;
    });
  }

  return Promise.resolve();
};

export const hasBalanceVideo = async (
  connection?: RTCPeerConnection,
  ignoreForCodec?: string
): Promise<boolean> => {
  if (!ignoreForCodec) {
    return !!connection;
  }

  const senders = connection?.getSenders();
  const codec = await getCodecFromPeerConnection(senders);

  return !!(connection && codec && codec !== ignoreForCodec);
};
