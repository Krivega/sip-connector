import { setElementVisible } from './domUiHelpers';
import { getErrorMessage } from './inputParsing';

import type { TCallReconnectIndicatorState } from '../Statuses';

const formatNamedError = (name: string, value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return `${name}: ${getErrorMessage(value)}`;
};

const formatScalarForDisplay = (value: number | undefined): string => {
  if (value === undefined) {
    return '-';
  }

  return String(value);
};

const formatErrorsLine = (state: TCallReconnectIndicatorState): string => {
  const parts = [
    formatNamedError('lastFailureCause', state.lastFailureCause),
    formatNamedError('lastError', state.lastError),
    formatNamedError('cancelledReason', state.cancelledReason),
  ].filter((line) => {
    return line !== undefined;
  });

  return parts.length > 0 ? parts.join(', ') : '-';
};

/**
 * Отрисовка баннера переподключения звонка (`#callReconnectIndicator`) по MST-модели статуса.
 */
export class CallReconnectIndicatorPresenter {
  private readonly indicatorElement: HTMLElement;

  public constructor(indicatorElement: HTMLElement) {
    this.indicatorElement = indicatorElement;
  }

  private static buildMessage(state: TCallReconnectIndicatorState): string {
    return [
      `Восстановление звонка: состояние ${state.state}`,
      `попытка ${formatScalarForDisplay(state.attempt)}`,
      `следующая задержка ${formatScalarForDisplay(state.nextDelayMs)} мс`,
      `ошибки: ${formatErrorsLine(state)}`,
    ].join('; ');
  }

  public render(state: TCallReconnectIndicatorState): void {
    const isReconnectIndicatorVisible = state.isReconnecting || state.isErrorTerminal;

    setElementVisible(this.indicatorElement, isReconnectIndicatorVisible);
    this.indicatorElement.textContent = CallReconnectIndicatorPresenter.buildMessage(state);
  }
}
