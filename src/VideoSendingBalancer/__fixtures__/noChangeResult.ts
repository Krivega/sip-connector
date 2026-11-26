import type { TResultSetParametersToSender } from '@/tools';

/**
 * Ожидаемая форма результата балансировки, при которой параметры отправителя не менялись
 */
export const NO_CHANGE_RESULT: TResultSetParametersToSender = {
  isChanged: false,
  parameters: {
    encodings: [{}],
    transactionId: '0',
    codecs: [],
    headerExtensions: [],
    rtcp: {},
  },
};
