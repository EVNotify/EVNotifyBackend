var fs = require('fs'),
    path = require('path');

/**
 * Function which translates the text (or a general placeholder) into the specified language
 * @param  {String} text the text to translate
 * @param  {String} lng  the language in which the text should be translated
 * @return {String}      the translated text in the specified language
 */
exports.translate = function(text, lng) {
    var allowedLng = ['en', 'de'];

    // validate requested language
    if(allowedLng.indexOf(lng) === -1) return text;
    // try to read the language file and translate the requested text
    try {
        return JSON.parse(fs.readFileSync(path.join(__dirname, 'lng', lng + '.json')))[text];
    } catch (e) {
        return text;    // just return text
    }
};
