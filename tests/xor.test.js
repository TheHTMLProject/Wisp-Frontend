import { test } from 'node:test';
import assert from 'node:assert';
import { xor } from '../src/utils/xor.js';

test('xor utility', async (t) => {
    await t.test('encode handles empty string', () => {
        assert.strictEqual(xor.encode(''), '');
        assert.strictEqual(xor.encode(null), null);
        assert.strictEqual(xor.encode(undefined), undefined);
    });

    await t.test('decode handles empty string', () => {
        assert.strictEqual(xor.decode(''), '');
        assert.strictEqual(xor.decode(null), null);
        assert.strictEqual(xor.decode(undefined), undefined);
    });

    await t.test('encodes and decodes simple string', () => {
        const input = 'hello world';
        const encoded = xor.encode(input);
        const decoded = xor.decode(encoded);
        assert.strictEqual(decoded, input);
        assert.notStrictEqual(encoded, input);
    });

    await t.test('encodes and decodes string with special characters', () => {
        const input = 'https://google.com/search?q=test';
        const encoded = xor.encode(input);
        const decoded = xor.decode(encoded);
        assert.strictEqual(decoded, input);
    });

    await t.test('encodes correctly (manual verification)', () => {
        // 'a' charCode is 97. Index 0 (even) -> 'a'
        // 'b' charCode is 98. 98 ^ 2 = 96 ('`'). Index 1 (odd) -> '`'
        // 'c' charCode is 99. Index 2 (even) -> 'c'
        // 'd' charCode is 100. 100 ^ 2 = 102 ('f'). Index 3 (odd) -> 'f'
        // Result: "a`cf"
        // Encoded: encodeURIComponent("a`cf") -> "a%60cf"

        const input = 'abcd';
        const expected = encodeURIComponent('a`cf');
        assert.strictEqual(xor.encode(input), expected);
    });

    await t.test('decode handles invalid URI component', () => {
        const invalid = '%E0%A4%A'; // Invalid URI sequence
        assert.strictEqual(xor.decode(invalid), invalid);
    });
});
