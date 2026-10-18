const assert = require('assert');
const { loadModule } = require('../helpers');

describe('translation placeholders', () => {
    let loader;

    beforeEach(() => {
        loader = loadModule('./modules/translation', {
            fs: { readFileSync: filename => JSON.stringify(filename.endsWith('de.json') ? {
                MESSAGE: 'Deutsch: {SOC} / {SOC}; {RANGE}; {MISSING}'
            } : {
                MESSAGE: 'English: {SOC} / {SOC}; {RANGE}; {MISSING}',
                ARRAY: '{0} / {1} / {2}; {10}',
                FALLBACK: 'Fallback: {SOC}'
            }) }
        });
    });

    afterEach(() => loader.restore());

    it('replaces repeated placeholders and preserves missing placeholders', () => {
        assert.strictEqual(loader.module.translateWithData('MESSAGE', 'DE', { SOC: '80%', RANGE: 120 }),
            'Deutsch: 80% / 80%; 120; {MISSING}');
    });

    [0, false, '', null, undefined].forEach(value => {
        it('preserves placeholders for falsy object values: ' + value, () => {
            assert.strictEqual(loader.module.translateWithData('FALLBACK', 'en', { SOC: value }),
                'Fallback: {SOC}');
        });
    });

    it('preserves single-digit array substitution, including absent and falsy values', () => {
        assert.strictEqual(loader.module.translateWithData('ARRAY', 'en', [0, false]),
            '0 / false / undefined; {10}');
    });

    it('leaves placeholders unchanged without substitution data', () => {
        [undefined, {}, 'text'].forEach(data => {
            assert.strictEqual(loader.module.translateWithData('FALLBACK', 'en', data), 'Fallback: {SOC}');
        });
    });

    it('retains English fallback for missing translations and unsupported languages', () => {
        assert.strictEqual(loader.module.translateWithData('FALLBACK', 'de', { SOC: '80%' }, true), 'Fallback: 80%');
        assert.strictEqual(loader.module.translateWithData('FALLBACK', 'fr', { SOC: '80%' }, true), 'Fallback: 80%');
        assert.strictEqual(loader.module.translateWithData('FALLBACK', 'fr', { SOC: '80%' }), 'FALLBACK');
        assert.strictEqual(loader.module.translate('UNKNOWN', 'de', true), 'UNKNOWN');
    });
});
