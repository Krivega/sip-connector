import getPriorityCodecs from '@/tools/getPriorityCodecs';
import hasNotSupportedH264CodecForVideoSendingBalancer from '@/tools/hasNotSupportedH264CodecForVideoSendingBalancer';

let ignoreForCodec: string | undefined;

if (hasNotSupportedH264CodecForVideoSendingBalancer()) {
  ignoreForCodec = 'h264';
}

export const VIDEO_BALANCER_OPTIONS = {
  ignoreForCodec,
};
export const PREFERRED_MIME_TYPES_VIDEO_CODECS = getPriorityCodecs();
export const ONE_MEGABIT_IN_BITS = 1e6;
