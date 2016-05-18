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
      plugins: {asyncawait: pluginOptions || {}}
    });
}

var tests = [
       {desc:"Simple async function",code:"async function x() { return undefined; }",
           pass:function(ast){ return ast.body[0].async===true}
       },
       {desc:"Await in async is AwaitExpression",code:"async function x() { await(undefined); await undefined ; }",
           pass:function(ast){ return ast.body[0].body.body[0].expression.type==='AwaitExpression' && ast.body[0].body.body[1].expression.type==='AwaitExpression'}
       },
       {desc:"Await in function is identifier",code:"function x() { await(undefined); }",
           pass:function(ast){ return ast.body[0].body.body[0].expression.callee.name==='await'}
       },
       {desc:"Async method",code:"var a = {async x(){}}",
           pass:function(ast){ return ast.body[0].declarations[0].init.properties[0].value.async }
       },
       {desc:"Async get method",code:"var a = {async get x(){}}",
           pass:function(ast){ return ast.body[0].declarations[0].init.properties[0].value.async }
       },
       {desc:"Async arrow",code:"var a = async()=>0",
           pass:function(ast){ return ast.body[0].declarations[0].init.async }
       },
       {desc:"Async set method fails",code:"var a = {async set x(){}}",
           pass:function(ex){ return ex === "'set <member>(value)' cannot be be async (1:15)" }
       },
       {desc:"Async constructor fails",code:"var a = {async constructor(){}}",
           pass:function(ex){ return ex === "'constructor()' cannot be be async (1:15)" }
       },
       {desc:"Await declaration fails in async function",code:"async function x() { var await; }",
           pass:function(ex){ return ex === "'await' is reserved within async functions (1:25)" }
       },
       {desc:"Await function declaration fails in async function",code:"async function x() { function await() {} }",
           pass:function(ex){ return ex === "'await' is reserved within async functions (1:30)" }
       },
       {desc:"Await reference fails in async function",code:"async function x() { return 1+await; }",
           pass:function(ex){ return ex === "Unexpected token (1:35)" }
       },{
    desc: "async /* comment *\u002f function x(){} is an async FunctionDeclaration",
    code: "async /* a *\u002f function x(){}",
    pass: function (ast) {
        return ast.body[0].async === true && ast.body[0].type == "FunctionDeclaration";
    }
},{
    desc: "async /* comment *\u002f <linefeed> function x(){} is a reference to 'async' and a sync FunctionDeclaration",
    code: "async /* a *\u002f\nfunction x(){}",
    pass: function (ast) {
        return ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === 'Identifier' && ast.body[0].expression.name === 'async' && !ast.body[1].async === true && ast.body[1].type == "FunctionDeclaration";
    }
},{
    desc: "async <linefeed> function x(){} is a reference to 'async' and a sync FunctionDeclaration",
    code: "async\nfunction x(){}",
    pass: function (ast) {
        return ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === 'Identifier' && ast.body[0].expression.name === 'async' && !ast.body[1].async === true && ast.body[1].type == "FunctionDeclaration";
    }
},{
    desc: "async // comment <linefeed> function x(){} is a reference to 'async' and a sync FunctionDeclaration",
    code: "async //\nfunction x(){}",
    pass: function (ast) {
        return ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === 'Identifier' && ast.body[0].expression.name === 'async' && !ast.body[1].async === true && ast.body[1].type == "FunctionDeclaration";
    }
},{
    desc: "await(x) is an AwaitExpression when inAsyncFunction option is true",
    code: "await(x)",
    options: { inAsyncFunction: true },
    pass: function (ast) {
        return ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === 'AwaitExpression' ;
    }},
    {
      desc: "await(x) is an CallExpression when inAsyncFunction option is false",
        code: "await(x)",
        pass: function (ast) {
            return ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === 'CallExpression' ;
        }
      }
] ;

var out = {
  true:"pass".green,
  false:"fail".red
};

tests.forEach(function(test,idx){
    try {
        console.log((idx+1)+")\t",test.desc,test.code.replace('\n',' <linefeed> ').yellow,out[test.pass(parse(test.code,test.options))]);
    } catch(ex) {
        console.log((idx+1)+")\t",test.desc,test.code.replace('\n',' <linefeed> ').yellow,ex.message.cyan,out[test.pass(ex.message)]);
    }
}) ;
