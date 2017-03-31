"use strict";
const acorn = require('acorn'); 
require('..')(acorn);
var code = process.argv.slice(2).join(' ')
var ast = acorn.parse(code,{
    // Specify use of the plugin
    plugins:{asyncawait:true},
    // Specify the ecmaVersion
    ecmaVersion: 8
}) ;
// Show the AST
console.log(JSON.stringify(ast,null,2)) ;