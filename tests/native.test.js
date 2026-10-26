import { describe, it, expect } from 'vitest';
import { startAdMob, createNativeBilling, adUnitFor, AD_UNITS } from '../src/monetize/native.js';
import { createAds } from '../src/monetize/ads.js';

function fakeAdMob({ consentRequired = false, canRequestAds = true, reward = { type: 'coins', amount: 1 } } = {}) {
  const calls = [];
  return {
    calls,
    requestConsentInfo: async () => { calls.push('consentInfo'); return { status: consentRequired ? 'REQUIRED' : 'OBTAINED', isConsentFormAvailable: true, canRequestAds: !consentRequired && canRequestAds }; },
    showConsentForm: async () => { calls.push('consentForm'); return { status: 'OBTAINED', canRequestAds }; },
    trackingAuthorizationStatus: async () => ({ status: 'notDetermined' }),
    requestTrackingAuthorization: async () => { calls.push('att'); },
    initialize: async (o) => { calls.push(['init', o]); },
    prepareRewardVideoAd: async (o) => { calls.push(['prepare', o.adId, o.isTesting]); },
    showRewardVideoAd: async () => { calls.push('show'); if (reward instanceof Error) throw reward; return reward; },
  };
}

describe('AdMob start-up', () => {
  it('asks for consent first, then starts the SDK', async () => {
    const admob = fakeAdMob();
    expect(await startAdMob(admob, 'android')).toBe(true);
    expect(admob.calls[0]).toBe('consentInfo');
    expect(admob.calls.at(-1)[0]).toBe('init');
  });

  it('caps ad content at parental guidance (an all-ages game; the privacy policy promises it)', async () => {
    const admob = fakeAdMob();
    await startAdMob(admob, 'android');
    expect(admob.calls.at(-1)[1]).toEqual({ maxAdContentRating: 'ParentalGuidance' });
  });

  it('shows the consent form when the law requires it (EU/UK)', async () => {
    const admob = fakeAdMob({ consentRequired: true });
    expect(await startAdMob(admob, 'android')).toBe(true);
    expect(admob.calls).toContain('consentForm');
  });

  it('no consent, no ads (the game simply offers no rewarded ads)', async () => {
    const admob = fakeAdMob({ consentRequired: true, canRequestAds: false });
    expect(await startAdMob(admob, 'android')).toBe(false);
    expect(admob.calls.some((c) => c[0] === 'init')).toBe(false);
  });

  it('asks iPhone users for tracking permission (ATT); Android does not', async () => {
    const ios = fakeAdMob();
    await startAdMob(ios, 'ios');
    expect(ios.calls).toContain('att');
    const android = fakeAdMob();
    await startAdMob(android, 'android');
    expect(android.calls).not.toContain('att');
  });

  it('a plugin failure means no ads, not a crash', async () => {
    const admob = { ...fakeAdMob(), requestConsentInfo: async () => { throw new Error('no network'); } };
    expect(await startAdMob(admob, 'android')).toBe(false);
  });
});

describe('rewarded ads through AdMob', () => {
  it('rewards only when the user earned it', async () => {
    const admob = fakeAdMob();
    const ads = createAds({ native: true, admob, adUnitId: 'unit-1' });
    expect(await ads.showRewarded('revive')).toBe(true);
    const skipped = createAds({ native: true, admob: fakeAdMob({ reward: { type: '', amount: 0 } }), adUnitId: 'u' });
    expect(await skipped.showRewarded('revive')).toBe(false);
    const broken = createAds({ native: true, admob: fakeAdMob({ reward: new Error('closed early') }), adUnitId: 'u' });
    expect(await broken.showRewarded('revive')).toBe(false);
  });

  it('test ads stay on until real ad units are configured', () => {
    expect(adUnitFor('android', {}).isTesting).toBe(true);
    expect(adUnitFor('ios', {}).id).toBe(AD_UNITS.test.ios);
    const real = adUnitFor('android', { VITE_ADMOB_REWARDED_ANDROID: 'ca-app-pub-1111111111111111/2222222222' });
    expect(real).toEqual({ id: 'ca-app-pub-1111111111111111/2222222222', isTesting: false });
  });

  it('ignores a malformed ad unit id (falls back to test ads)', () => {
    expect(adUnitFor('android', { VITE_ADMOB_REWARDED_ANDROID: 'oops' }).isTesting).toBe(true);
  });
});

describe('store billing bridge', () => {
  function fakePurchases({ purchases = [], fail = false } = {}) {
    return {
      isBillingSupported: async () => ({ isBillingSupported: true }),
      getProduct: async ({ productIdentifier }) => ({ product: { identifier: productIdentifier, priceString: '₩3,300' } }),
      purchaseProduct: async () => { if (fail) throw new Error('cancelled'); return { transactionId: 't1' }; },
      getPurchases: async () => ({ purchases }),
    };
  }
  const TYPES = { INAPP: 'inapp' };

  it('shows the price from the store (never hard-coded)', async () => {
    const b = await createNativeBilling(fakePurchases(), TYPES, ['remove_ads']);
    expect(b.price('remove_ads')).toBe('₩3,300');
    expect(b.price('unknown')).toBeNull();
  });

  it('buying succeeds or quietly fails (cancelled)', async () => {
    expect(await (await createNativeBilling(fakePurchases(), TYPES, ['remove_ads'])).buy('remove_ads')).toBe(true);
    await expect((await createNativeBilling(fakePurchases({ fail: true }), TYPES, ['remove_ads'])).buy('remove_ads')).rejects.toThrow();
  });

  it('restore counts finished purchases, not pending ones', async () => {
    const b = await createNativeBilling(fakePurchases({
      purchases: [
        { productIdentifier: 'remove_ads', purchaseState: '1' },
        { productIdentifier: 'other', purchaseState: 'PENDING' },
        { productIdentifier: 'ios_item' }, // iOS has no purchaseState: present means owned
      ],
    }), TYPES, ['remove_ads']);
    expect(await b.owned()).toEqual(['remove_ads', 'ios_item']);
  });
});
