import { setParametersToSender } from '@/tools/setParametersToSender';
import getCodecFromSender from '@/utils/getCodecFromSender';
import {
  getMinimumBitrateByWidthAndCodec,
  getMaximumBitrateByWidthAndCodec,
} from '@/VideoSendingBalancer';

export const MINIMUM_BITRATE_AUDIO = 6000; // 6 kbps
export const MINIMUM_BITRATE_VIDEO = 1000; // 1 kbps
export const MAXIMUM_BITRATE_AUDIO = 520_000; // 520 kbps

/**
 * Находит все RTCRtpSender'ы для указанного типа медиа
 */
const getSendersByKind = (
  connection: RTCPeerConnection,
  kind: 'audio' | 'video',
): RTCRtpSender[] => {
  return connection.getSenders().filter((sender) => {
    return sender.track?.kind === kind;
  });
};

const getMinimumBitrate = (kind: 'audio' | 'video', codec?: string): number => {
  return kind === 'audio' ? MINIMUM_BITRATE_AUDIO : getMinimumBitrateByWidthAndCodec(codec);
};

type TSenderWithTrack = RTCRtpSender & { track: MediaStreamTrack & { kind: 'audio' | 'video' } };

const hasSenderWithTrack = (sender: RTCRtpSender): sender is TSenderWithTrack => {
  return sender.track !== null;
};

/**
 * Менеджер состояния битрейта для RTCRtpSender'ов.
 * Отвечает за сохранение, изменение и восстановление значений битрейта.
 */
export default class BitrateStateManager {
  private readonly previousBitrates = new Map<RTCRtpSender, RTCRtpEncodingParameters[]>();

  /**
   * Устанавливает минимальный битрейт для указанных типов потоков
   * @param connection - активное RTCPeerConnection
   * @param kinds - типы потоков ('audio' | 'video' | 'all')
   */
  public async setMinBitrateForSenders(
    connection: RTCPeerConnection | undefined,
    kinds: 'audio' | 'video' | 'all' = 'all',
  ): Promise<void> {
    const senders: RTCRtpSender[] = [];

    if (!connection) {
      return;
    }

    if (kinds === 'audio' || kinds === 'all') {
      senders.push(...getSendersByKind(connection, 'audio'));
    }

    if (kinds === 'video' || kinds === 'all') {
      senders.push(...getSendersByKind(connection, 'video'));
    }

    const promises = senders.filter(hasSenderWithTrack).map(async (sender: TSenderWithTrack) => {
      const currentParameters = sender.getParameters();

      // Сохраняем текущие параметры перед изменением
      this.saveCurrentBitrate(sender, currentParameters);

      const targetParameters: RTCRtpSendParameters = {
        ...currentParameters,
        encodings: currentParameters.encodings.map((encoding) => {
          return {
            ...encoding,
            maxBitrate: getMinimumBitrate(sender.track.kind),
          };
        }),
      };

      await setParametersToSender(sender, targetParameters);
    });

    await Promise.all(promises);
  }

  /**
   * Восстанавливает предыдущий битрейт для указанных типов потоков
   * @param connection - активное RTCPeerConnection
   * @param kinds - типы потоков ('audio' | 'video' | 'all')
   */
  public async restoreBitrateForSenders(
    connection: RTCPeerConnection | undefined,
    kinds: 'audio' | 'video' | 'all' = 'all',
  ): Promise<void> {
    const senders: RTCRtpSender[] = [];

    if (!connection) {
      return;
    }

    if (kinds === 'audio' || kinds === 'all') {
      senders.push(...getSendersByKind(connection, 'audio'));
    }

    if (kinds === 'video' || kinds === 'all') {
      senders.push(...getSendersByKind(connection, 'video'));
    }

    const promises = senders.map(async (sender) => {
      const savedEncodings = this.getSavedBitrate(sender);

      if (savedEncodings) {
        const currentParameters = sender.getParameters();
        const isVideo = sender.track?.kind === 'video';
        const codec = isVideo ? await getCodecFromSender(sender) : undefined; // Для audio codec не используется, но getCodecFromSender вызывается (включая getStats()). Это лишняя нагрузка.
        const targetParameters: RTCRtpSendParameters = {
          ...currentParameters,
          encodings: savedEncodings.map((encoding) => {
            const maxBitrate = isVideo
              ? getMaximumBitrateByWidthAndCodec(codec)
              : MAXIMUM_BITRATE_AUDIO;

            return {
              ...encoding,

              // В Safari и некоторых браузерах encodings изначально не содержат maxBitrate.
              // setMinBitrateForSenders сохраняет currentParameters в previousBitrates как есть,
              // поэтому туда попадают encodings с maxBitrate: undefined.
              // Без проверки restoreBitrateForSenders применил бы undefined вместо восстановления битрейта.
              // Подставляем дефолт: MAXIMUM_BITRATE_AUDIO для audio, getMaximumBitrateByWidthAndCodec для video.
              maxBitrate: encoding.maxBitrate ?? maxBitrate,
            };
          }),
        };

        await setParametersToSender(sender, targetParameters, { isResetAllowed: true });

        // Очищаем сохраненные параметры после восстановления
        this.clearSavedBitrate(sender);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Получает сохраненные параметры битрейта для отправителя
   */
  public getSavedBitrate(sender: RTCRtpSender): RTCRtpEncodingParameters[] | undefined {
    return this.previousBitrates.get(sender);
  }

  /**
   * Удаляет сохраненные параметры битрейта для отправителя
   */
  public clearSavedBitrate(sender: RTCRtpSender): void {
    this.previousBitrates.delete(sender);
  }

  /**
   * Очищает все сохраненные состояния битрейта
   */
  public clearAll(): void {
    this.previousBitrates.clear();
  }

  /**
   * Проверяет, есть ли сохраненное состояние для отправителя
   */
  public hasSavedBitrate(sender: RTCRtpSender): boolean {
    return this.previousBitrates.has(sender);
  }

  /**
   * Возвращает количество сохраненных состояний
   */
  public getSavedCount(): number {
    return this.previousBitrates.size;
  }

  /**
   * Сохраняет текущие параметры битрейта для отправителя
   */
  public saveCurrentBitrate(sender: RTCRtpSender, currentParameters: RTCRtpSendParameters): void {
    const encodings = currentParameters.encodings.map((encoding) => {
      return { ...encoding };
    });

    this.previousBitrates.set(sender, encodings);
  }
}
