module.exports = function(acorn) {
    switch (parseInt(acorn.version)) {
    case 3:
        acorn.plugins.asyncawait = require('./acorn-v3') ;
        break ;
    case 4:
        acorn.plugins.asyncawait = require('./acorn-v4') ;
        break ;
    default:
        throw new Error("acorn-es7-plugin requires Acorn v3 or v4") ;
    }
    return acorn
}
