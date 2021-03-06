var validator = require('../validation/validator');

/**
 * @param image
 * @constructor
 */
function Brightness(image) {
    
    this.image = image;

    /**
     * @type {string|null}
     */
    this.error = null;

    this.settings = {
        /**
         * @type {number|null}
         */
        brightness: null
    };

    this.brightness = this.brightness.bind(this);
}

/**
 * @summary brightness of the image
 * @description supports a numeric value between `-100` and `100`
 * @param {string|number} brightness a Number between `-100` and `100`
 * @returns {*} the operation
 */
Brightness.prototype.brightness = function (brightness) {

    this.error = validator.numberNotInRange('brightness', brightness, -100, 100);
    if (this.error) {
        return this.image;
    }

    this.settings.brightness = brightness === void 0 ? null : brightness;
    return this.image;
};

/**
 * @returns {string}
 */
Brightness.prototype.serialize = function () {

    var out = '';

    if (this.settings.brightness) {
        out += 'br_' + this.settings.brightness;
    }

    return {
        params: out,
        error: this.error
    };
};

/**
 * @type {Brightness}
 */
module.exports = Brightness;