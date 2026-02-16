import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createFeedbackHandler } from '../src/handlers/feedback.js';

describe('Feedback Handler', () => {
    let originalWebhook;

    before(() => {
        originalWebhook = process.env.DISCORD_WEBHOOK;
    });

    after(() => {
        process.env.DISCORD_WEBHOOK = originalWebhook;
    });

    const createMockReqRes = (body = {}) => {
        const req = { body };
        const reply = {
            statusCode: 200,
            payload: null,
            code(code) {
                this.statusCode = code;
                return this;
            },
            send(payload) {
                this.payload = payload;
                return this;
            }
        };
        return { req, reply };
    };

    it('Should return 500 if DISCORD_WEBHOOK is not configured', async () => {
        delete process.env.DISCORD_WEBHOOK;

        const { req, reply } = createMockReqRes();
        const handler = createFeedbackHandler(() => {});
        await handler(req, reply);

        assert.strictEqual(reply.statusCode, 500);
        assert.deepStrictEqual(reply.payload, { success: false, error: "Feedback service not configured" });
    });

    it('Should return 400 if message is missing', async () => {
        process.env.DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
        const { req, reply } = createMockReqRes({});
        const handler = createFeedbackHandler(() => {});
        await handler(req, reply);

        assert.strictEqual(reply.statusCode, 400);
        assert.deepStrictEqual(reply.payload, { success: false, error: "Message is required" });
    });

    it('Should return 400 if message is empty', async () => {
        process.env.DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
        const { req, reply } = createMockReqRes({ message: '   ' });
        const handler = createFeedbackHandler(() => {});
        await handler(req, reply);

        assert.strictEqual(reply.statusCode, 400);
        assert.deepStrictEqual(reply.payload, { success: false, error: "Message is required" });
    });

    it('Should return 400 if message is too long', async () => {
        process.env.DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
        const longMessage = 'a'.repeat(2001);
        const { req, reply } = createMockReqRes({ message: longMessage });
        const handler = createFeedbackHandler(() => {});
        await handler(req, reply);

        assert.strictEqual(reply.statusCode, 400);
        assert.deepStrictEqual(reply.payload, { success: false, error: "Message too long (max 2000 characters)" });
    });

    it('Should send feedback successfully', async () => {
        process.env.DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
        const { req, reply } = createMockReqRes({
            message: 'Test message',
            username: 'TestUser',
            feedbackType: 'Bug Report'
        });

        let fetchCalled = false;
        let fetchUrl;
        let fetchOptions;

        const mockFetch = async (url, options) => {
            fetchCalled = true;
            fetchUrl = url;
            fetchOptions = options;
            return { ok: true };
        };

        const handler = createFeedbackHandler(mockFetch);
        await handler(req, reply);

        assert.strictEqual(fetchCalled, true);
        assert.strictEqual(fetchUrl, process.env.DISCORD_WEBHOOK);
        assert.strictEqual(fetchOptions.method, 'POST');

        const body = JSON.parse(fetchOptions.body);
        assert.strictEqual(body.embeds[0].description, 'Test message');
        assert.strictEqual(body.embeds[0].title, 'New Feedback - Bug Report');
        assert.strictEqual(body.embeds[0].color, 0xef4444);
        assert.deepStrictEqual(body.embeds[0].fields, [{ name: 'User', value: 'TestUser', inline: true }]);

        assert.strictEqual(reply.payload.success, true);
        assert.strictEqual(reply.payload.message, "Feedback sent successfully!");
    });

    it('Should return 500 if Discord API returns error', async () => {
        process.env.DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
        const { req, reply } = createMockReqRes({ message: 'Test message' });

        const mockFetch = async () => {
            return { ok: false };
        };

        const handler = createFeedbackHandler(mockFetch);
        await handler(req, reply);

        assert.strictEqual(reply.statusCode, 500);
        assert.deepStrictEqual(reply.payload, { success: false, error: "Failed to send feedback" });
    });

    it('Should return 500 if fetch throws error', async () => {
        process.env.DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/test';
        const { req, reply } = createMockReqRes({ message: 'Test message' });

        const mockFetch = async () => {
            throw new Error('Network error');
        };

        const handler = createFeedbackHandler(mockFetch);
        await handler(req, reply);

        assert.strictEqual(reply.statusCode, 500);
        assert.deepStrictEqual(reply.payload, { success: false, error: "Failed to send feedback" });
    });
});
