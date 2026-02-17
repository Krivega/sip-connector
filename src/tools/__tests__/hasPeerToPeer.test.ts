/// <reference types="jest" />
import hasPeerToPeer from '../hasPeerToPeer';

describe('hasPeerToPeer', () => {
  it('возвращает true для p2pAtoB', () => {
    expect(hasPeerToPeer('p2pAtoB')).toBe(true);
  });

  it('возвращает true для p2puser.to@domainto123', () => {
    expect(hasPeerToPeer('p2puser.to@domainto123')).toBe(true);
  });

  it('возвращает true для p2p123to456', () => {
    expect(hasPeerToPeer('p2p123to456')).toBe(true);
  });

  it('возвращает false для undefined', () => {
    expect(hasPeerToPeer(undefined)).toBe(false);
  });

  it('возвращает false для пустой строки', () => {
    expect(hasPeerToPeer('')).toBe(false);
  });

  it('возвращает false для purgatory', () => {
    expect(hasPeerToPeer('purgatory')).toBe(false);
  });

  it('возвращает false для p2p без частей', () => {
    expect(hasPeerToPeer('p2p')).toBe(false);
  });

  it('возвращает false для p2pto без callee', () => {
    expect(hasPeerToPeer('p2pto')).toBe(false);
  });

  it('возвращает false для p2pab без литерала to', () => {
    expect(hasPeerToPeer('p2pab')).toBe(false);
  });

  it('возвращает false для комнаты с to без префикса p2p', () => {
    expect(hasPeerToPeer('room-with-to-in-middle')).toBe(false);
  });
});
