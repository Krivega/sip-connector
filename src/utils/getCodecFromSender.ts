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

const getCodecFromSender = (sender: RTCRtpSender): Promise<string | undefined> => {
  return sender.getStats().then((stats: RTCStatsReport) => {
    const codec = findInResultByType(stats, 'codec');

    return codec?.mimeType;
  });
};

export default getCodecFromSender;
