self.__literature$config = {
    prefix: '/literature/route/',
    bare: '/history/',

    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/literature/uv.handler.js',
    bundle: '/literature/uv.bundle.js',
    config: '/config-literature.js',
    sw: '/sw-literature.js',
};