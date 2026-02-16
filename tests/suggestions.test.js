import { test } from 'node:test';
import assert from 'node:assert';
import { createSuggestionsHandler } from '../src/suggestions.js';

test('suggestions handler', async (t) => {
    await t.test('returns empty array if q is missing', async () => {
        const fetch = async () => {};
        const handler = createSuggestionsHandler(fetch);
        const req = { query: {} };
        const reply = {};
        const result = await handler(req, reply);
        assert.deepStrictEqual(result, []);
    });

    await t.test('returns suggestions on successful fetch', async () => {
        const mockData = ["query", ["suggestion1", "suggestion2"]];
        const fetch = async (url) => {
            assert.match(url, /duckduckgo\.com\/ac\/\?q=test/);
            return {
                ok: true,
                json: async () => mockData
            };
        };
        const handler = createSuggestionsHandler(fetch);
        const req = { query: { q: 'test' } };
        const reply = {};
        const result = await handler(req, reply);
        assert.deepStrictEqual(result, ["suggestion1", "suggestion2"]);
    });

    await t.test('returns empty array if fetch fails (network error)', async () => {
        const fetch = async () => {
            throw new Error('Network error');
        };
        const handler = createSuggestionsHandler(fetch);
        const req = { query: { q: 'test' } };
        const reply = {};
        const result = await handler(req, reply);
        assert.deepStrictEqual(result, []);
    });

    await t.test('returns empty array if response is not ok', async () => {
        const fetch = async () => {
             return {
                ok: false,
                status: 500
            };
        };
        const handler = createSuggestionsHandler(fetch);
        const req = { query: { q: 'test' } };
        const reply = {};
        const result = await handler(req, reply);
        assert.deepStrictEqual(result, []);
    });

    await t.test('encodes query parameter', async () => {
        const fetch = async (url) => {
            assert.match(url, /q=hello%20world/);
            return {
                ok: true,
                json: async () => ["hello world", ["s1"]]
            };
        };
        const handler = createSuggestionsHandler(fetch);
        const req = { query: { q: 'hello world' } };
        const result = await handler(req, {});
        assert.deepStrictEqual(result, ["s1"]);
    });
});
