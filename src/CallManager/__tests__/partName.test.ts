import { createPartNameExtraHeader, PART_NAME_HEADER } from '../partName';

describe('createPartNameExtraHeader', () => {
  it('возвращает пустой массив, если partName не передан', () => {
    expect(createPartNameExtraHeader()).toEqual([]);
  });

  it('возвращает пустой массив, если partName пустая строка', () => {
    expect(createPartNameExtraHeader('')).toEqual([]);
  });

  it('формирует заголовок X-VINTEO-PARTNAME', () => {
    expect(createPartNameExtraHeader('John Doe')).toEqual([`${PART_NAME_HEADER}: John Doe`]);
  });
});
