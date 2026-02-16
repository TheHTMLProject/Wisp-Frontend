import { test } from 'node:test';
import assert from 'node:assert';
import webpush from 'web-push';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '../.env') });

test('VAPID Keys Validation', (t) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        t.skip('VAPID keys not found in environment variables. Skipping validation.');
        return;
    }

    try {
        const pubBuffer = Buffer.from(publicKey, 'base64');
        assert.strictEqual(pubBuffer.length, 65, 'Public Key length should be 65 bytes');

        // Ensure keys are valid for webpush
        webpush.setVapidDetails('mailto:test@example.com', publicKey, privateKey);
        assert.ok(true, 'VAPID details set successfully');
    } catch (e) {
        assert.fail(`VAPID Validation Error: ${e.message}`);
    }
});
