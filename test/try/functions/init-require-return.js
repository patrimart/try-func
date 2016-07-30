
module.exports = function (v) {

    var Double = require('../../utils/math').Double;

    return 'OK Result '+ Double(v || 2);
};
