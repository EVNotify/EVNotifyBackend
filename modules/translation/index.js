/**
 * @file modules/translation/index.js
 * @author GPlay97
 * @description Module for translation
 */
const fs = require('fs'),
    path = require('path'),
    stringInject = require('stringinject').default,
    allowedLng = ['en', 'de'];

let translations = {};

/**
 * Function which translates the text (or a general placeholder) into the specified language
 * @param  {String} text             the text to translate
 * @param  {String} lng              the language in which the text should be translated
 * @param  {Boolean} englishFallback if set to true, english will be used for unknown languages and missing translations.
 * @return {String}                  the translated text in the specified language
 */
const translate = (text, lng, englishFallback) => translateWithData(text, lng, undefined, englishFallback);

/**
 * Function which translates the text (or a general placeholder) into the specified language
 * @param  {String} text             the text to translate
 * @param  {String} lng              the language in which the text should be translated
 * @param  {Boolean} englishFallback if set to true, english will be used for unknown languages and missing translations.
 * @param  {Object} data             the replacements for placeholders, where the keys are the ids of the placeholders in the text and the values are the respective replacements
 * @return {String}                  the translated text in the specified language
 */
const translateWithData = (text, lng, data, englishFallback) => {
    let translated;

    if (typeof lng === 'string') lng = lng.toLocaleLowerCase();
    // validate request language
    if (allowedLng.indexOf(lng) === -1) {
        if (englishFallback) return translateWithData(text, 'en', data, false);
        return text;
    }
    // read language file if not in cache
    if (!translations[lng]) translations[lng] = JSON.parse(fs.readFileSync(path.join(__dirname, 'lng', lng + '.json')));
    // try to translate text
    try {
        translated = translations[lng][text];
    } catch(e) {}
    if (translated) {
        if (data) translated = stringInject(translated, data);
        return translated;
    }
    if (englishFallback) return translateWithData(text, 'en', data, false);
    return text;
};


module.exports = {
    translate,
    translateWithData
};
