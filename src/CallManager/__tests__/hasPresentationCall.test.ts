import hasPresentationCall from '../hasPresentationCall';

describe('hasPresentationCall', () => {
  it('возвращает false, если extraHeaders не передан', () => {
    expect(hasPresentationCall()).toBe(false);
  });

  it('возвращает false, если extraHeaders пустой', () => {
    expect(hasPresentationCall([])).toBe(false);
  });

  it('возвращает true, если есть заголовок X-Vinteo-Presentation-Call: yes', () => {
    expect(hasPresentationCall(['X-Vinteo-Presentation-Call: yes'])).toBe(true);
  });

  it('возвращает true при другом регистре заголовка', () => {
    expect(hasPresentationCall(['x-vinteo-presentation-call: YES'])).toBe(true);
  });

  it('возвращает true при лишних пробелах вокруг заголовка', () => {
    expect(hasPresentationCall(['  X-Vinteo-Presentation-Call: yes  '])).toBe(true);
  });

  it('возвращает false, если значение заголовка не yes', () => {
    expect(hasPresentationCall(['X-Vinteo-Presentation-Call: no'])).toBe(false);
  });

  it('возвращает false, если нужного заголовка нет среди других', () => {
    expect(
      hasPresentationCall(['X-Test: 1', 'X-Vinteo-Presentation-Mode: yes', 'X-Other: value']),
    ).toBe(false);
  });
});
