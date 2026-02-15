import { test, describe } from 'node:test';
import assert from 'node:assert';
import { codec } from '../public/astronomy-codec.js';

describe('Astronomy Codec', () => {
    describe('encode', () => {
        test('should return input if null or undefined', () => {
            assert.strictEqual(codec.encode(null), null);
            assert.strictEqual(codec.encode(undefined), undefined);
            assert.strictEqual(codec.encode(''), '');
        });

        test('should encode a simple URL', () => {
            const url = 'https://example.com';
            const encoded = codec.encode(url);
            assert.notStrictEqual(encoded, url);
        });

        test('should handle query parameters', () => {
            const url = 'https://example.com?q=test';
            const encoded = codec.encode(url);
            assert.ok(encoded.includes('?q=test'));
            const [path, query] = encoded.split('?');
            assert.strictEqual(query, 'q=test');
        });
    });

    describe('decode', () => {
        test('should return input if null or undefined', () => {
            assert.strictEqual(codec.decode(null), null);
            assert.strictEqual(codec.decode(undefined), undefined);
            assert.strictEqual(codec.decode(''), '');
        });

        test('should decode an encoded URL', () => {
            const url = 'https://example.com/path';
            const encoded = codec.encode(url);
            const decoded = codec.decode(encoded);
            assert.strictEqual(decoded, url);
        });

        test('should handle stripping the prefix pattern', () => {
            const prefix = 'abcdef01/12345678/';
            const url = 'https://example.com';
            const encoded = codec.encode(url);
            const fullInput = prefix + encoded;

            const decoded = codec.decode(fullInput);
            assert.strictEqual(decoded, url);
        });

        test('should decode URL with query parameters', () => {
            const url = 'https://example.com?query=123';
            const encoded = codec.encode(url);
            const decoded = codec.decode(encoded);
            assert.strictEqual(decoded, url);
        });

         test('should decode URL with query parameters and prefix', () => {
            const prefix = 'abcdef01/12345678/';
            const url = 'https://example.com?query=123';
            const encoded = codec.encode(url);
            const fullInput = prefix + encoded;

            const decoded = codec.decode(fullInput);
            assert.strictEqual(decoded, url);
        });
    });

    describe('Round Trip', () => {
        test('should work for complex URLs', () => {
            const url = 'https://sub.example.com/some/path/file.html?param=value&other=123#hash';
            const encoded = codec.encode(url);
            const decoded = codec.decode(encoded);
            assert.strictEqual(decoded, url);
        });
    });
});
