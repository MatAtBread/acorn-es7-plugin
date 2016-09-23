module.exports = function(acorn) {
    switch (parseInt(acorn.version)) {
    case 2:
    case 3:
        acorn.plugins.asyncawait = require('./acorn-v3') ;
        break ;
    case 4:
        acorn.plugins.asyncawait = require('./acorn-v4') ;
        break ;
    default:
        throw new Error("acorn-es7-plugin requires Acorn v2, 3 or 4") ;
    }
    return acorn
}
