export function getIP(socket) {
    const headers = socket.handshake.headers;
    if (headers['cf-connecting-ip']) return headers['cf-connecting-ip'];
    if (headers['x-real-ip']) return headers['x-real-ip'];
    if (headers['x-forwarded-for']) return headers['x-forwarded-for'].split(',')[0].trim();
    return socket.handshake.address;
}
