'use strict';

const { addonV1Shim } = require('@embroider/addon-shim');
module.exports = addonV1Shim(__dirname);
const included = module.exports.included;

Object.assign(module.exports, {
  _getBabelOptions() {
    const parentOptions = this.parent && this.parent.options;
    const appOptions = this.app && this.app.options;
    const addonOptions = parentOptions || appOptions || {};

    addonOptions.babel = addonOptions.babel || {};
    addonOptions.babel.plugins = addonOptions.babel.plugins || [];
    return addonOptions.babel;
  },
  included(...args) {
    this._getBabelOptions().plugins.splice(0, 0, [require.resolve('./dist/lib/babel-plugin.js'), { v: 2 }]);
    this._super.included; // need to access this somehow? otherwise it fails later on...
    included.call(this, ...args);
  }
})

