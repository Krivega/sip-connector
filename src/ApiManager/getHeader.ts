import {
  EContentedStreamCodec,
  EContentTypeReceived,
  EContentMainCAM,
  EContentMic,
  EContentSyncMediaState,
  EKeyHeader,
  EContentParticipantType,
  EContentUseLicense,
  EContentedStreamSendAndReceive,
} from './constants';

import type { IncomingRequest } from '@krivega/jssip';
import type { EValueHeader } from './constants';

// Helper functions for validation
const isValidString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

const findEnumValue = <T extends Record<string, string>>(
  enumObject: T,
  value: string,
): T[keyof T] | undefined => {
  const lowerValue = value.toLowerCase();
  const foundEntry = Object.entries(enumObject).find(([, enumValue]) => {
    return typeof enumValue === 'string' && enumValue.toLowerCase() === lowerValue;
  });

  return foundEntry ? (foundEntry[1] as T[keyof T]) : undefined;
};

const isValidNumber = (value: unknown): value is number => {
  return (
    typeof value === 'string' && !Number.isNaN(Number(value)) && Number.isFinite(Number(value))
  );
};

const parseNumberValue = (value: string): number | undefined => {
  if (!isValidNumber(value)) {
    return undefined;
  }

  return Number(value);
};

const parseBooleanValue = (value: string): boolean | undefined => {
  const lower = value.toLowerCase();

  if (lower === 'true' || lower === '1') {
    return true;
  }

  if (lower === 'false' || lower === '0') {
    return false;
  }

  return undefined;
};

export const getHeader = <T extends EKeyHeader>(
  request: IncomingRequest,
  header: T,
): EValueHeader<T> | undefined => {
  const value = request.getHeader(header.toLowerCase());

  if (!isValidString(value)) {
    return undefined;
  }

  const lowerValue = value.toLowerCase();

  switch (header) {
    case EKeyHeader.BEARER_TOKEN: {
      return value as EValueHeader<T>;
    }
    case EKeyHeader.CONTENT_ENTER_ROOM:
    case EKeyHeader.PARTICIPANT_NAME:
    case EKeyHeader.INPUT_CHANNELS:
    case EKeyHeader.OUTPUT_CHANNELS:
    case EKeyHeader.TRACKS_DIRECTION:
    case EKeyHeader.AUDIO_ID:
    case EKeyHeader.MAIN_CAM_RESOLUTION:
    case EKeyHeader.MEDIA_STATE:
    case EKeyHeader.NOTIFY:
    case EKeyHeader.CONTENT_ENABLE_MEDIA_DEVICE: {
      return lowerValue as EValueHeader<T>;
    }
    case EKeyHeader.MEDIA_TYPE:
    case EKeyHeader.MAIN_CAM_STATE:
    case EKeyHeader.MIC_STATE:
    case EKeyHeader.AVAILABLE_INCOMING_BITRATE:
    case EKeyHeader.AUDIO_TRACK_COUNT:
    case EKeyHeader.VIDEO_TRACK_COUNT: {
      return parseNumberValue(lowerValue) as EValueHeader<T> | undefined;
    }
    case EKeyHeader.CONTENTED_STREAM_CODEC: {
      return findEnumValue(EContentedStreamCodec, lowerValue) as EValueHeader<T> | undefined;
    }
    case EKeyHeader.CONTENT_TYPE: {
      return findEnumValue(EContentTypeReceived, lowerValue) as EValueHeader<T> | undefined;
    }
    case EKeyHeader.CONTENT_USE_LICENSE: {
      return findEnumValue(EContentUseLicense, lowerValue) as EValueHeader<T> | undefined;
    }
    case EKeyHeader.MAIN_CAM: {
      return findEnumValue(EContentMainCAM, lowerValue) as EValueHeader<T> | undefined;
    }
    case EKeyHeader.MIC: {
      return findEnumValue(EContentMic, lowerValue) as EValueHeader<T> | undefined;
    }
    case EKeyHeader.MEDIA_SYNC: {
      return findEnumValue(EContentSyncMediaState, lowerValue) as EValueHeader<T> | undefined;
    }
    case EKeyHeader.CONTENT_PARTICIPANT_STATE: {
      return findEnumValue(EContentParticipantType, lowerValue) as EValueHeader<T> | undefined;
    }
    case EKeyHeader.CONTENTED_STREAM_STATE: {
      return findEnumValue(EContentedStreamSendAndReceive, lowerValue) as
        | EValueHeader<T>
        | undefined;
    }
    case EKeyHeader.IS_DIRECT_PEER_TO_PEER: {
      return parseBooleanValue(lowerValue) as EValueHeader<T> | undefined;
    }
    default: {
      return undefined;
    }
  }
};
