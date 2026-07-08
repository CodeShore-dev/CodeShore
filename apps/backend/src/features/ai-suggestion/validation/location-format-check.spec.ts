import { isStandardLocationGroupFormat } from './location-format-check';

describe('isStandardLocationGroupFormat', () => {
  it.each([
    '台北市信義區',
    '新竹縣竹北市',
    '高雄市苓雅區',
    '南投縣埔里鎮',
    '嘉義縣布袋鄉',
  ])('accepts a well-formed 縣市+鄉鎮市區 id: %s', id => {
    expect(isStandardLocationGroupFormat(id)).toBe(true);
  });

  it.each([
    'taipei',
    'hsinchu',
    '信義區',
    '台北市',
    '台北市信義',
    'TaipeiXinyi',
    '',
  ])('rejects a non-conforming id: %s', id => {
    expect(isStandardLocationGroupFormat(id)).toBe(false);
  });
});
