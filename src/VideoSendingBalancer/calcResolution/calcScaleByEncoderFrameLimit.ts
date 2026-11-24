// shortcut: лимит H.264 применяется при любом кодеке, учитывать кодек, если сервер начнёт принимать для демонстрации не только H.264
const ENCODER_MAX_MACROBLOCKS = 36_864;
const MACROBLOCK_SIZE = 16;
const SCALE_MIN = 1;
const SCALE_STEP = 1.001;

const countMacroblocks = (width: number, height: number): number => {
  return Math.ceil(width / MACROBLOCK_SIZE) * Math.ceil(height / MACROBLOCK_SIZE);
};

const countScaledMacroblocks = (width: number, height: number, scale: number): number => {
  return countMacroblocks(Math.ceil(width / scale), Math.ceil(height / scale));
};

/**
 * Минимальный scaleResolutionDownBy, при котором кадр укладывается в предел H.264-энкодера
 * (OpenH264 не инициализируется при площади кадра больше 36 864 макроблоков 16×16).
 */
const calcScaleByEncoderFrameLimit = ({
  videoTrack,
}: {
  videoTrack: MediaStreamVideoTrack;
}): number => {
  const { width, height } = videoTrack.getSettings();

  if (width === undefined || height === undefined) {
    return SCALE_MIN;
  }

  let scale = Math.max(
    SCALE_MIN,
    Math.sqrt(countMacroblocks(width, height) / ENCODER_MAX_MACROBLOCKS),
  );

  // Округление до целых макроблоков оставляет кадр над пределом после масштаба по площади
  while (countScaledMacroblocks(width, height, scale) > ENCODER_MAX_MACROBLOCKS) {
    scale *= SCALE_STEP;
  }

  return scale;
};

export default calcScaleByEncoderFrameLimit;
