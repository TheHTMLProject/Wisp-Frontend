import webpush from 'web-push';
import dotenv from 'dotenv';
dotenv.config();

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (!publicKey || !privateKey) {
    console.error('VAPID keys not found in environment variables. Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
    process.exit(1);
}

try {
    const pubBuffer = Buffer.from(publicKey, 'base64');
    console.log('Public Key Length:', pubBuffer.length);
    console.log('Public Key Valid:', pubBuffer.length === 65);

    webpush.setVapidDetails('mailto:lightlink.noreply@gmail.com', publicKey, privateKey);
    console.log('VAPID Details Set successfully');
} catch (e) {
    console.error('VAPID Validation Error:', e.message);
}
