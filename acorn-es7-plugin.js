module.exports = function(acorn) {
    switch (parseInt(acorn.version)) {
    case 2:
    case 3:
        acorn.plugins.asyncawait = require('./acorn-v3')(acorn) ;
        break ;
    case 4:
    case 5:
        acorn.plugins.asyncawait = require('./acorn-v4')(acorn) ;
        break ;
    default:
        throw new Error("acorn-es7-plugin requires Acorn v2, 3, 4 or 5") ;
    }
    return acorn
}
