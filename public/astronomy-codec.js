export const codec = {
    encode: (url) => {
        if (!url) return url;
        const [path, ...query] = url.split('?');
        return encodeURIComponent(path.split('').map((char, ind) => ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char).join('')) + (query.length ? '?' + query.join('?') : '');
    },
    decode: (url) => {
        if (!url) return url;
        let input = url;
        const match = url.match(/^([a-z0-9]{8}\/[a-z0-9]{8}\/)(.*)$/);
        if (match) {
            input = match[2];
        }
        const [path, ...query] = input.split('?');
        return decodeURIComponent(path).split('').map((char, ind) => ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char).join('') + (query.length ? '?' + query.join('?') : '');
    }
};
