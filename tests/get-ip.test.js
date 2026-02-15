import { test } from 'node:test';
import assert from 'node:assert';
import { getIP } from '../profiles/get-ip.js';

test('getIP utility', async (t) => {
    await t.test('returns cf-connecting-ip if present', () => {
        const socket = {
            handshake: {
                headers: {
                    'cf-connecting-ip': '1.1.1.1',
                    'x-real-ip': '2.2.2.2',
                    'x-forwarded-for': '3.3.3.3',
                },
                address: '4.4.4.4',
            },
        };
        assert.strictEqual(getIP(socket), '1.1.1.1');
    });

    await t.test('returns x-real-ip if cf-connecting-ip is missing', () => {
        const socket = {
            handshake: {
                headers: {
                    'x-real-ip': '2.2.2.2',
                    'x-forwarded-for': '3.3.3.3',
                },
                address: '4.4.4.4',
            },
        };
        assert.strictEqual(getIP(socket), '2.2.2.2');
    });

    await t.test('returns first x-forwarded-for IP if others are missing', () => {
        const socket = {
            handshake: {
                headers: {
                    'x-forwarded-for': '3.3.3.3, 5.5.5.5',
                },
                address: '4.4.4.4',
            },
        };
        assert.strictEqual(getIP(socket), '3.3.3.3');
    });

    await t.test('returns x-forwarded-for IP without spaces', () => {
        const socket = {
            handshake: {
                headers: {
                    'x-forwarded-for': ' 3.3.3.3 ',
                },
                address: '4.4.4.4',
            },
        };
        assert.strictEqual(getIP(socket), '3.3.3.3');
    });

    await t.test('returns handshake address as fallback', () => {
        const socket = {
            handshake: {
                headers: {},
                address: '4.4.4.4',
            },
        };
        assert.strictEqual(getIP(socket), '4.4.4.4');
    });

    await t.test('handles empty headers gracefully', () => {
         const socket = {
            handshake: {
                headers: {},
                address: '127.0.0.1'
            }
        };
        assert.strictEqual(getIP(socket), '127.0.0.1');
    });
});
