/// <reference types="jest" />
import getExtraHeadersRemoteAddress from '../getExtraHeadersRemoteAddress';

describe('getExtraHeadersRemoteAddress', () => {
  it('должен возвращать пустой массив, когда remoteAddress не передан', () => {
    const result = getExtraHeadersRemoteAddress();

    expect(result).toEqual([]);
  });

  it('должен возвращать пустой массив, когда remoteAddress равен undefined', () => {
    const result = getExtraHeadersRemoteAddress(undefined);

    expect(result).toEqual([]);
  });

  it('должен возвращать пустой массив, когда remoteAddress равен пустой строке', () => {
    const result = getExtraHeadersRemoteAddress('');

    expect(result).toEqual([]);
  });

  it('должен возвращать массив с заголовком X-Vinteo-Remote, когда remoteAddress передан', () => {
    const remoteAddress = '192.168.1.100';
    const result = getExtraHeadersRemoteAddress(remoteAddress);

    expect(result).toEqual([`X-Vinteo-Remote: ${remoteAddress}`]);
  });

  it('должен возвращать массив с заголовком X-Vinteo-Remote для IP адреса', () => {
    const remoteAddress = '10.10.10.10';
    const result = getExtraHeadersRemoteAddress(remoteAddress);

    expect(result).toEqual([`X-Vinteo-Remote: ${remoteAddress}`]);
  });

  it('должен возвращать массив с заголовком X-Vinteo-Remote для доменного имени', () => {
    const remoteAddress = 'example.com';
    const result = getExtraHeadersRemoteAddress(remoteAddress);

    expect(result).toEqual([`X-Vinteo-Remote: ${remoteAddress}`]);
  });

  it('должен возвращать массив с заголовком X-Vinteo-Remote для адреса с портом', () => {
    const remoteAddress = '192.168.1.100:8080';
    const result = getExtraHeadersRemoteAddress(remoteAddress);

    expect(result).toEqual([`X-Vinteo-Remote: ${remoteAddress}`]);
  });

  it('должен возвращать массив с заголовком X-Vinteo-Remote для IPv6 адреса', () => {
    const remoteAddress = '2001:db8::1';
    const result = getExtraHeadersRemoteAddress(remoteAddress);

    expect(result).toEqual([`X-Vinteo-Remote: ${remoteAddress}`]);
  });

  it('должен возвращать массив с заголовком X-Vinteo-Remote для строки с пробелами', () => {
    const remoteAddress = ' 192.168.1.100 ';
    const result = getExtraHeadersRemoteAddress(remoteAddress);

    expect(result).toEqual([`X-Vinteo-Remote: ${remoteAddress}`]);
  });
});
