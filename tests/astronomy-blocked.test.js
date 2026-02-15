import { test } from 'node:test';
import assert from 'node:assert';
import { isBlockedUrl } from '../public/astronomy-blocked.js';

test('isBlockedUrl utility', async (t) => {
    await t.test('blocks exact matches', () => {
        assert.strictEqual(isBlockedUrl('https://googleadservices.com'), true);
        assert.strictEqual(isBlockedUrl('http://doubleclick.net/path'), true);
        assert.strictEqual(isBlockedUrl('https://taboola.com'), true);
    });

    await t.test('blocks subdomains', () => {
        assert.strictEqual(isBlockedUrl('https://www.googleadservices.com'), true);
        assert.strictEqual(isBlockedUrl('https://ads.doubleclick.net'), true);
        assert.strictEqual(isBlockedUrl('https://sub.sub.taboola.com'), true);
    });

    await t.test('allows unblocked domains', () => {
        assert.strictEqual(isBlockedUrl('https://google.com'), false);
        assert.strictEqual(isBlockedUrl('https://example.com'), false);
        assert.strictEqual(isBlockedUrl('https://github.com'), false);
    });

    await t.test('handles similar but unblocked domains', () => {
        assert.strictEqual(isBlockedUrl('https://mygoogleadservices.com'), false);
        assert.strictEqual(isBlockedUrl('https://not-doubleclick.net'), false);
    });

    await t.test('handles invalid URLs gracefully', () => {
        assert.strictEqual(isBlockedUrl('not a url'), false);
        assert.strictEqual(isBlockedUrl(''), false);
        assert.strictEqual(isBlockedUrl(null), false);
        assert.strictEqual(isBlockedUrl(undefined), false);
    });

    await t.test('handles URLs without protocol (if URL constructor handles them or throws)', () => {
        // new URL('example.com') throws. So isBlockedUrl should return false.
        assert.strictEqual(isBlockedUrl('example.com'), false);
        // new URL('//example.com') might work depending on environment but usually needs base.
        // In Node: new URL('//example.com') throws "Invalid URL".
    });
});
