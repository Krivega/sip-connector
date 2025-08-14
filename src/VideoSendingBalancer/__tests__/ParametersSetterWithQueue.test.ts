/// <reference types="jest" />
import RTCRtpSenderMock from '@/__fixtures__/RTCRtpSenderMock';
import { ParametersSetterWithQueue } from '../ParametersSetterWithQueue';

import type { IEncodingParameters } from '../types';

describe('ParametersSetterWithQueue', () => {
  let parametersSetter: ParametersSetterWithQueue;
  let sender: RTCRtpSender;
  let onSetParameters: jest.Mock;

  beforeEach(() => {
    sender = new RTCRtpSenderMock();
    onSetParameters = jest.fn();
    parametersSetter = new ParametersSetterWithQueue(onSetParameters);
  });

  describe('constructor', () => {
    it('должен создать экземпляр без onSetParameters', () => {
      const setter = new ParametersSetterWithQueue();

      expect(setter).toBeInstanceOf(ParametersSetterWithQueue);
    });

    it('должен создать экземпляр с onSetParameters', () => {
      const setter = new ParametersSetterWithQueue(onSetParameters);

      expect(setter).toBeInstanceOf(ParametersSetterWithQueue);
    });
  });

  describe('setEncodingsToSender', () => {
    it('должен добавить задачу в очередь', async () => {
      const parameters: IEncodingParameters = {
        scaleResolutionDownBy: 2,
        maxBitrate: 1_000_000,
      };

      const promise = parametersSetter.setEncodingsToSender(sender, parameters);

      // Проверяем, что промис не завершился сразу
      expect(promise).toBeInstanceOf(Promise);

      // Ждем завершения
      await promise;

      // Проверяем, что параметры были установлены
      const currentParameters = sender.getParameters();

      expect(currentParameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 2,
          maxBitrate: 1_000_000,
        },
      ]);
    });

    it('должен выполнить несколько задач последовательно', async () => {
      const parameters1: IEncodingParameters = {
        scaleResolutionDownBy: 2,
        maxBitrate: 1_000_000,
      };

      const parameters2: IEncodingParameters = {
        scaleResolutionDownBy: 1,
        maxBitrate: 2_000_000,
      };

      // Добавляем задачи в очередь последовательно
      await parametersSetter.setEncodingsToSender(sender, parameters1);
      await parametersSetter.setEncodingsToSender(sender, parameters2);

      // Проверяем, что установлены последние параметры
      const currentParameters = sender.getParameters();

      expect(currentParameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 1,
          maxBitrate: 2_000_000,
        },
      ]);
    });

    it('должен вызвать onSetParameters при изменении параметров', async () => {
      const parameters: IEncodingParameters = {
        scaleResolutionDownBy: 2,
        maxBitrate: 1_000_000,
      };

      await parametersSetter.setEncodingsToSender(sender, parameters);

      expect(onSetParameters).toHaveBeenCalledTimes(1);
      expect(onSetParameters).toHaveBeenCalledWith(
        expect.objectContaining({
          encodings: [
            {
              scaleResolutionDownBy: 2,
              maxBitrate: 1_000_000,
            },
          ],
        }),
      );
    });

    it('не должен вызывать onSetParameters при отсутствии изменений', async () => {
      const parameters: IEncodingParameters = {
        scaleResolutionDownBy: 1,
        maxBitrate: 1_000_000,
      };

      // Устанавливаем те же параметры дважды
      await parametersSetter.setEncodingsToSender(sender, parameters);
      await parametersSetter.setEncodingsToSender(sender, parameters);

      // onSetParameters должен быть вызван только один раз (при первом изменении)
      expect(onSetParameters).toHaveBeenCalledTimes(1);
    });

    it('должен обработать ошибку в задаче', async () => {
      // Создаем невалидный sender, который выбросит ошибку при setParameters
      const invalidSender = {
        getParameters: () => {
          return {
            encodings: [{}],
            transactionId: '0',
            codecs: [],
            headerExtensions: [],
            rtcp: {},
          };
        },
        setParameters: jest.fn().mockRejectedValue(new Error('Test error')),
      } as unknown as RTCRtpSender;

      const parameters: IEncodingParameters = {
        scaleResolutionDownBy: 2,
        maxBitrate: 1_000_000,
      };

      // TaskQueue подавляет ошибки, поэтому задача должна завершиться успешно
      await expect(
        parametersSetter.setEncodingsToSender(invalidSender, parameters),
      ).resolves.toBeUndefined();
    });
  });

  describe('stop', () => {
    it('должен остановить очередь задач', async () => {
      const parameters: IEncodingParameters = {
        scaleResolutionDownBy: 2,
        maxBitrate: 1_000_000,
      };

      // Добавляем задачу в очередь
      await parametersSetter.setEncodingsToSender(sender, parameters);

      // Останавливаем очередь
      parametersSetter.stop();

      // Проверяем, что задача выполнилась
      const currentParameters = sender.getParameters();

      expect(currentParameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 2,
          maxBitrate: 1_000_000,
        },
      ]);
    });

    it('должен позволить остановить очередь несколько раз', () => {
      expect(() => {
        parametersSetter.stop();
        parametersSetter.stop();
        parametersSetter.stop();
      }).not.toThrow();
    });

    it('должен обрабатывать задачи после остановки', async () => {
      const parameters: IEncodingParameters = {
        scaleResolutionDownBy: 2,
        maxBitrate: 1_000_000,
      };

      // Останавливаем очередь до добавления задач
      parametersSetter.stop();

      // Пытаемся добавить задачу после остановки
      const promise = parametersSetter.setEncodingsToSender(sender, parameters);

      // Ждем завершения
      await promise;

      // Проверяем, что задача выполнилась
      const currentParameters = sender.getParameters();

      expect(currentParameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 2,
          maxBitrate: 1_000_000,
        },
      ]);
    });
  });

  describe('интеграция с TaskQueue', () => {
    it('должен выполнять задачи последовательно', async () => {
      const parameters1: IEncodingParameters = {
        scaleResolutionDownBy: 2,
        maxBitrate: 1_000_000,
      };

      const parameters2: IEncodingParameters = {
        scaleResolutionDownBy: 1,
        maxBitrate: 2_000_000,
      };

      const parameters3: IEncodingParameters = {
        scaleResolutionDownBy: 4,
        maxBitrate: 500_000,
      };

      // Добавляем задачи в очередь последовательно
      await parametersSetter.setEncodingsToSender(sender, parameters1);
      await parametersSetter.setEncodingsToSender(sender, parameters2);
      await parametersSetter.setEncodingsToSender(sender, parameters3);

      // Проверяем, что установлены последние параметры
      const currentParameters = sender.getParameters();

      expect(currentParameters.encodings).toEqual([
        {
          scaleResolutionDownBy: 4,
          maxBitrate: 500_000,
        },
      ]);

      // Проверяем, что onSetParameters был вызван для каждого изменения
      expect(onSetParameters).toHaveBeenCalledTimes(3);
    });
  });
});
