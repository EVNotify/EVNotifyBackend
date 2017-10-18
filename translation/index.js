var fs = require('fs'),
    path = require('path'),
    allowedLng = ['en', 'de', 'nl'],
    translations = {};

/**
 * Function which translates the text (or a general placeholder) into the specified language
 * @param  {String} text             the text to translate
 * @param  {String} lng              the language in which the text should be translated
 * @param  {String} englishFallback  if set to a truthy value, english will be used for unknown languages and missng translations.
 * @return {String}                  the translated text in the specified language
 */
exports.translate = function (text, lng, englishFallback) {
    var translated;
    if (typeof lng === 'string') lng = lng.toLocaleLowerCase();
    // validate requested language
    if (allowedLng.indexOf(lng) === -1) {
        if (englishFallback) {
            return this.translate(text, 'en', false);
        } else {
            return text;
        }
    }

    // read the language file if not in cache
    if (!translations[lng]) {
        translations[lng] = JSON.parse(fs.readFileSync(path.join(__dirname, 'lng', lng + '.json')));
    }
    // translate the requested text
    try {
        translated = translations[lng][text];
    } catch (e) {
    }
    // return translation or fallback
    if (translated) {
        return translated;
    }
    if (englishFallback) {
        return this.translate(text, 'en', false);
    }
    return text;
};
