import resolveParameters from '../resolveParameters';

describe('resolveParameters', () => {
  it('должен возвращать объект, если передан объект', async () => {
    const parameters = {
      userAgent: 'test-agent',
      sipServerUrl: 'wss://test.com',
      sipServerIp: 'sip://test.com',
      user: 'test-user',
      register: true,
    };

    const result = await resolveParameters(parameters);

    expect(result).toEqual(parameters);
  });

  it('должен вызывать функцию и возвращать результат, если передана функция', async () => {
    const parameters = {
      userAgent: 'test-agent',
      sipServerUrl: 'wss://test.com',
      sipServerIp: 'sip://test.com',
      user: 'test-user',
      register: true,
    };

    const getParameters = jest.fn().mockResolvedValue(parameters);

    const result = await resolveParameters(getParameters);

    expect(getParameters).toHaveBeenCalledTimes(1);
    expect(result).toEqual(parameters);
  });

  it('должен обрабатывать асинхронную функцию', async () => {
    const parameters = {
      userAgent: 'test-agent',
      sipServerUrl: 'wss://test.com',
      sipServerIp: 'sip://test.com',
      user: 'test-user',
      register: true,
    };

    const getParameters = async () => {
      return parameters;
    };

    const result = await resolveParameters(getParameters);

    expect(result).toEqual(parameters);
  });

  it('должен обрабатывать функцию с ошибкой', async () => {
    const error = new Error('Get parameters is failed');
    const getParameters = jest.fn().mockRejectedValue(error);

    await expect(resolveParameters(getParameters)).rejects.toThrow(error);
    expect(getParameters).toHaveBeenCalledTimes(1);
  });

  it('должен обрабатывать пустой объект', async () => {
    const parameters = {};

    const result = await resolveParameters(parameters);

    expect(result).toEqual({});
  });

  it('должен обрабатывать функцию, возвращающую пустой объект', async () => {
    const getParameters = jest.fn().mockResolvedValue({});

    const result = await resolveParameters(getParameters);

    expect(getParameters).toHaveBeenCalledTimes(1);
    expect(result).toEqual({});
  });
});
