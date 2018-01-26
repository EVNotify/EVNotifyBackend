var fs = require('fs'),
    path = require('path'),
    stringInject = require('stringinject').default,
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
    return this.translateWithData(text, lng, undefined, englishFallback)
};

/**
 * Function which translates the text (or a general placeholder) into the specified language
 * @param  {String} text             the text to translate
 * @param  {String} lng              the language in which the text should be translated
 * @param  {String} englishFallback  if set to a truthy value, english will be used for unknown languages and missng translations.
 * @param  {Object} data             the replacements for placeholders, where the keys are the ids of the placeholders in the text and the values are the respective replacements
 * @return {String}                  the translated text in the specified language
 */
exports.translateWithData = function (text, lng, data, englishFallback) {
    var translated;
    if (typeof lng === 'string') lng = lng.toLocaleLowerCase();
    // validate requested language
    if (allowedLng.indexOf(lng) === -1) {
        if (englishFallback) {
            return this.translateWithData(text, 'en', data, false);
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
        if (data) {
            translated = stringInject(translated, data);
        }
        return translated;
    }
    if (englishFallback) {
        return this.translateWithData(text, 'en', data, false);
    }
    return text;
};
