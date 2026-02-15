import { test } from 'node:test';
import assert from 'node:assert';
import { search } from '../public/search.js';

test('search utility', async (t) => {
    const template = 'https://duckduckgo.com/?q=%s';

    await t.test('handles absolute URLs with protocol', () => {
        assert.strictEqual(search('https://google.com', template), 'https://google.com/');
        assert.strictEqual(search('http://example.com/path', template), 'http://example.com/path');
    });

    await t.test('handles hostnames with dots', () => {
        assert.strictEqual(search('example.com', template), 'http://example.com/');
        assert.strictEqual(search('test.example.com/foo', template), 'http://test.example.com/foo');
    });

    await t.test('uses template for search queries', () => {
        assert.strictEqual(search('hello', template), 'https://duckduckgo.com/?q=hello');
        assert.strictEqual(search('hello world', template), 'https://duckduckgo.com/?q=hello%20world');
    });

    await t.test('handles special characters in search queries', () => {
        assert.strictEqual(search('c++', template), 'https://duckduckgo.com/?q=c%2B%2B');
        assert.strictEqual(search('?test=1', template), 'https://duckduckgo.com/?q=%3Ftest%3D1');
    });

    await t.test('handles localhost (no dot)', () => {
        // localhost doesn't have a dot, so it should be treated as a search query
        assert.strictEqual(search('localhost', template), 'https://duckduckgo.com/?q=localhost');
    });

    await t.test('handles IP addresses', () => {
        assert.strictEqual(search('1.1.1.1', template), 'http://1.1.1.1/');
    });
});
