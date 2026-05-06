import { dom } from '../dom';
import {
  getErrorMessage,
  parsePositiveIntegerInput,
  type TPositiveIntegerParseResult,
} from './inputParsing';

type TMainStreamRecoverySip = {
  setMinConsecutiveProblemSamplesCount: (value: number) => void;
  setThrottleRecoveryTimeout: (value: number) => void;
};

type TUserFeedback = {
  showWarning: (message: string) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

/**
 * Применение настроек восстановления основного потока из формы демо.
 */
export class MainStreamRecoverySettingsApplier {
  private readonly sip: TMainStreamRecoverySip;

  private readonly feedback: TUserFeedback;

  public constructor(sip: TMainStreamRecoverySip, feedback: TUserFeedback) {
    this.sip = sip;
    this.feedback = feedback;
  }

  public applyFromForm(): void {
    const minConsecutiveProblemSamplesCount = this.resolvePositiveInteger(
      parsePositiveIntegerInput({
        input: dom.minConsecutiveProblemSamplesCountInputElement,
        invalidMessage: 'Порог детекта проблемы должен быть положительным целым числом',
      }),
    );

    if (minConsecutiveProblemSamplesCount === undefined) {
      return;
    }

    const throttleRecoveryTimeout = this.resolvePositiveInteger(
      parsePositiveIntegerInput({
        input: dom.throttleRecoveryTimeoutInputElement,
        invalidMessage: 'Интервал восстановления должен быть положительным целым числом (мс)',
      }),
    );

    if (throttleRecoveryTimeout === undefined) {
      return;
    }

    try {
      this.sip.setMinConsecutiveProblemSamplesCount(minConsecutiveProblemSamplesCount);
      this.sip.setThrottleRecoveryTimeout(throttleRecoveryTimeout);
      this.feedback.showSuccess('Настройки восстановления применены');
    } catch (error) {
      this.feedback.showError(
        `Ошибка применения настроек восстановления: ${getErrorMessage(error)}`,
      );
    }
  }

  private resolvePositiveInteger(result: TPositiveIntegerParseResult): number | undefined {
    if (result.isValid) {
      return result.value;
    }

    this.feedback.showWarning(result.message);

    return undefined;
  }
}
