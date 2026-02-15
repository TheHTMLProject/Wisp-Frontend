import webpush from 'web-push';
const publicKey = 'BPIlwrM77Dy5KancCjN1NXgyjnTSgQ9LVJwaTMIVmie7ka2z2pZ_DxbQG1FOrppX7sWhIZH5eZj6ZtO3PDcCvHI';
const privateKey = 'QoEk55F6q2udU3c-51skYJSx94N3u6g-x9V3TypSv9g';

try {
    const pubBuffer = Buffer.from(publicKey, 'base64');
    console.log('Public Key Length:', pubBuffer.length);
    console.log('Public Key Valid:', pubBuffer.length === 65);

    webpush.setVapidDetails('mailto:lightlink.noreply@gmail.com', publicKey, privateKey);
    console.log('VAPID Details Set successfully');
} catch (e) {
    console.error('VAPID Validation Error:', e.message);
}
