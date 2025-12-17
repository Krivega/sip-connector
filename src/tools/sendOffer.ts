type TQuality = 'low' | 'medium' | 'high';

type TSendOfferParams = {
  /**
   * Базовый endpoint без номера конференции.
   * Например: "dev.vinteo.com".
   */
  serverUrl: string;
  /**
   * Номер конференции.
   * Например: "1008".
   */
  conferenceNumber: string;
  /**
   * Качество потока: low | medium | high.
   */
  quality: TQuality;
  /**
   * Идентификатор аудиоканала.
   * В примере из ТЗ соответствует query-параметру audio.
   */
  audio: string | number;
  /**
   * SDP-offer, который нужно отправить на сервер.
   */
  offer: RTCSessionDescriptionInit;
};

const ENDPOINT = '/api/v2/rtp2webrtc/offer/';

/**
 * Отправляет SDP-offer на MCU и возвращает SDP-answer.
 *
 * Формат запроса:
 *   POST {endpoint}/{conferenceNumber}?quality={quality}&audio={audio}
 * Пример:
 *   https://dev.vinteo.com/api/v2/rtp2webrtc/offer/1008?quality=medium&audio=0
 *
 * Ожидается, что сервер вернёт JSON с полями { type, sdp }.
 */
const sendOffer = async ({
  serverUrl,
  conferenceNumber,
  quality,
  audio,
  offer,
}: TSendOfferParams): Promise<RTCSessionDescription> => {
  const url = new URL(
    `https://${serverUrl.replace(/\/$/, '')}/${ENDPOINT}/${encodeURIComponent(conferenceNumber)}`,
  );

  url.searchParams.set('quality', quality);
  url.searchParams.set('audio', String(audio));

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(offer),
  });

  if (!response.ok) {
    throw new Error(`sendOffer failed with status ${response.status}`);
  }

  const data = (await response.json()) as {
    type: RTCSdpType;
    sdp: string;
  };

  return {
    type: data.type,
    sdp: data.sdp,
    toJSON() {
      return data;
    },
  };
};

export type { TSendOfferParams, TQuality };
export default sendOffer;
