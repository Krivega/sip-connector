const statsReportToArray = (results: RTCStatsReport): (RTCStats | undefined)[] => {
  return [...results.keys()].map((key) => {
    return results.get(key) as RTCStats | undefined;
  });
};

const findInResultByType = (results: RTCStatsReport, type: string): RTCStats | undefined => {
  return statsReportToArray(results).find((value) => {
    // @ts-expect-error
    return value.type === type;
  });
};

const getCodecFromSender = async (sender: RTCRtpSender): Promise<string | undefined> => {
  return sender.getStats().then((stats: RTCStatsReport) => {
    const codec = findInResultByType(stats, 'codec');

    return (codec as unknown as { mimeType: string } | undefined)?.mimeType;
  });
};

export default getCodecFromSender;
