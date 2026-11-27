const DEFAULT_CODEC = 'video/h264';

const createCodecStats = (mimeType: string): RTCStatsReport => {
  return new Map([['codec', { type: 'codec', mimeType }]]);
};

/**
 * Задаёт кодек, который отправитель отдаёт в sender.getStats()
 */
export const setSenderCodec = (sender: RTCRtpSender, mimeType: string): void => {
  jest.spyOn(sender, 'getStats').mockResolvedValue(createCodecStats(mimeType));
};

/**
 * Отправитель отдаёт в sender.getStats() статистику без кодека, например до согласования отправки
 */
export const setSenderStatsWithoutCodec = (sender: RTCRtpSender): void => {
  jest.spyOn(sender, 'getStats').mockResolvedValue(new Map());
};

/**
 * Откладывает ответ на следующий вызов sender.getStats() (получение кодека балансировкой)
 * @returns функция, которая отпускает отложенный ответ
 */
export const deferNextGetStats = (sender: RTCRtpSender, mimeType = DEFAULT_CODEC): (() => void) => {
  const stats = Promise.withResolvers<RTCStatsReport>();

  jest.spyOn(sender, 'getStats').mockReturnValueOnce(stats.promise);

  return () => {
    stats.resolve(createCodecStats(mimeType));
  };
};

/**
 * Следующий вызов sender.getStats() не отвечает
 */
export const hangNextGetStats = (sender: RTCRtpSender): void => {
  deferNextGetStats(sender);
};

/**
 * Все последующие вызовы sender.getStats() не отвечают
 */
export const hangGetStats = (sender: RTCRtpSender): void => {
  jest.spyOn(sender, 'getStats').mockReturnValue(new Promise<RTCStatsReport>(() => {}));
};

/**
 * Все последующие вызовы sender.getStats() отклоняются ошибкой
 */
export const rejectGetStats = (
  sender: RTCRtpSender,
  error: Error = new Error('getStats failed'),
): void => {
  jest.spyOn(sender, 'getStats').mockRejectedValue(error);
};
