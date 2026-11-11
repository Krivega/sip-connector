import {
  calcMaxBitrateByWidthAndCodec,
  getMinimumBitrate,
} from '@/VideoSendingBalancer/calcBitrate';
import { CODEC } from './constants';

const MAX_BITRATE_640 = calcMaxBitrateByWidthAndCodec(640, CODEC);
const MAX_BITRATE_1280 = calcMaxBitrateByWidthAndCodec(1280, CODEC);
const MAX_BITRATE_1920 = calcMaxBitrateByWidthAndCodec(1920, CODEC);
const MAX_BITRATE_3840 = calcMaxBitrateByWidthAndCodec(3840, CODEC);

// параметры 720p-трека без ограничений и с ограничением не ниже его разрешения
export const ENCODING_720P_BY_TRACK = { scaleResolutionDownBy: 1, maxBitrate: MAX_BITRATE_1280 };

// параметры 4K-трека по каждой команде и по maxAvailableResolution 1920x1080
export const ENCODING_4K_BY_TRACK = { scaleResolutionDownBy: 1, maxBitrate: MAX_BITRATE_3840 };
export const ENCODING_4K_LIMITED_TO_360P = {
  scaleResolutionDownBy: 6,
  maxBitrate: MAX_BITRATE_640,
};
export const ENCODING_4K_LIMITED_TO_720P = {
  scaleResolutionDownBy: 3,
  maxBitrate: MAX_BITRATE_1280,
};
export const ENCODING_4K_LIMITED_TO_1080P = {
  scaleResolutionDownBy: 2,
  maxBitrate: MAX_BITRATE_1920,
};
export const ENCODING_PAUSED = { scaleResolutionDownBy: 200, maxBitrate: getMinimumBitrate(CODEC) };
