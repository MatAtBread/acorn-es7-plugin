'use strict';

/* Simple test script that doesn't need mocha or similar - it just parses stuff and checks the returned AST */
var acorn = require('acorn');
var colors = require('colors');
require('../')(acorn);

function parse(code, pluginOptions) {
  if (Array.isArray(code)) {
    code = code.join('\n');
  }
  return acorn.parse(code, {
      sourceType: 'module',
      ecmaVersion: 7,
      locations: true,
      ranges: true,
      plugins: {asyncawait: pluginOptions || pluginOptions !== false}
    });
}

var tests = [
       {desc:"Simple async function",code:"async function x() { return undefined; }",
           pass:function(ast){ return ast.body[0].async===true}
       },
       {desc:"Await in async",code:"async function x() { await(undefined); }",
           pass:function(ast){ return ast.body[0].body.body[0].expression.type==='AwaitExpression'}
       },
       {desc:"Await in function",code:"function x() { await(undefined); }",
               pass:function(ast){ return ast.body[0].body.body[0].expression.callee.name==='await'}
       }
] ;

tests.forEach(function(test,idx){
    try {
        console.log((idx+1)+")\t",test.desc,test.pass(parse(test.code))?"pass".green:"fail".red);
    } catch(ex) {
        console.log((idx+1)+")\t",test.desc,ex.message.cyan,"fail".red);
    }
}) ;
