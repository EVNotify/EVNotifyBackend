const path = require('path');

// Restore every dependency and target cache entry, including after load failures.
const loadModule = (target, stubs) => {
    const resolve = name => require.resolve(name.startsWith('.') ? path.resolve(__dirname, '..', name) : name);
    const targetPath = resolve(target);
    const originals = new Map([[targetPath, require.cache[targetPath]]]);
    Object.keys(stubs).forEach(name => {
        const filename = resolve(name);
        originals.set(filename, require.cache[filename]);
        require.cache[filename] = { id: filename, filename, loaded: true, exports: stubs[name] };
    });
    const restore = () => originals.forEach((original, filename) => {
        if (original) require.cache[filename] = original;
        else delete require.cache[filename];
    });
    delete require.cache[targetPath];
    try {
        return { module: require(targetPath), restore };
    } catch (err) {
        restore();
        throw err;
    }
};

const createResponse = () => ({
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(payload) { this.body = payload; return this; }
});

module.exports = { loadModule, createResponse };
