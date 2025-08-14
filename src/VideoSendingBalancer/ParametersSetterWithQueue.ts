import { setEncodingsToSender } from '@/tools';
import { TaskQueue } from './TaskQueue';

import type { TOnSetParameters, TResultSetParametersToSender } from '@/tools';
import type { IEncodingParameters, IParametersSetter } from './types';

/**
 * Обёртка для ParametersSetter с использованием TaskQueue
 */
export class ParametersSetterWithQueue implements IParametersSetter {
  private readonly taskQueue: TaskQueue<TResultSetParametersToSender>;

  private readonly onSetParameters?: TOnSetParameters;

  public constructor(onSetParameters?: TOnSetParameters) {
    this.onSetParameters = onSetParameters;

    this.taskQueue = new TaskQueue();
  }

  public async setEncodingsToSender(
    sender: RTCRtpSender,
    parameters: IEncodingParameters,
  ): Promise<TResultSetParametersToSender> {
    return this.taskQueue.add(async () => {
      return setEncodingsToSender(sender, parameters, this.onSetParameters);
    });
  }

  public stop(): void {
    this.taskQueue.stop();
  }
}
