'use strict';
/* Simple test script that doesn't need mocha or similar - it just parses stuff and checks the returned AST */
var acorn = require('acorn');
var colors = require('colors');
require('../')(acorn);
function parse(code, pluginOptions, scriptType) {
    if (Array.isArray(code)) {
        code = code.join('\n');
    }
    return acorn.parse(code, {
        sourceType: scriptType,
        ecmaVersion: 8,
        locations: true,
        ranges: true,
        plugins: {
            asyncawait: pluginOptions || {}
        }
    });
}

function isIdentThenFnDecl(ast) {
    return ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === 'Identifier' && ast.body[0].expression.name === 'async' && !ast.body[1].async === true && ast.body[1].type == "FunctionDeclaration";
}

function isAsyncFnDecl(ast) {
    return ast.body[0].async === true && ast.body[0].type == "FunctionDeclaration";
}

function isExprType(type) {
    return function (ast, sourceType) {
        return ast.body[0].type === 'ExpressionStatement' && ast.body[0].expression.type === type;
    };
}

var tests = [
/* Standard behaviours */
{
    desc: "Simple async function",
    code: "async function x() { return undefined; }",
    pass: function (ast) {
        return ast.body[0].async === true;
    }
},{
    desc: "Await in async is AwaitExpression",
    code: "async function x() { await(undefined); await undefined ; }",
    pass: function (ast) {
        return ast.body[0].body.body[0].expression.type === 'AwaitExpression' && ast.body[0].body.body[1].expression.type === 'AwaitExpression';
    }
},{
    desc: "Await in function is identifier in 'script', illegal in 'module'",
    code: "function x() { await(undefined); }",
    pass: function (ast,scriptType) {
        return scriptType === 'script'?ast.body[0].body.body[0].expression.callee.name === 'await':ast.indexOf("(1:15)")>=0;
    }
},{
    desc: "Async method",
    code: "var a = {async x(){}}",
    pass: function (ast) {
        return ast.body[0].declarations[0].init.properties[0].value.async;
    }
},{
    desc: "Async arrow",
    code: "var a = async()=>0",
    pass: function (ast) {
        return ast.body[0].declarations[0].init.async;
    }
},{
    desc: "Parenthesized async arrow is a call",
    code: "var a = async(()=>0)",
    pass: function (ast) {
        return ast.body[0].declarations[0].init.type==='CallExpression';
    }
},{
    desc: "Await declaration fails in async function",
    code: "async function x() { var await; }",
    pass: function (ex, scriptType) {
      return ex.indexOf("(1:25)")>=0// === "'await' is reserved within async functions (1:25)":ex==="The keyword 'await' is reserved (1:25)";
    }
},{
    desc: "Await function declaration fails in async function",
    code: "async function x() { function await() {} }",
    pass: function (ex, scriptType) {
      return ex.indexOf("(1:30)")>=0//scriptType === 'script'?ex === "'await' is reserved within async functions (1:25)":ex==="The keyword 'await' is reserved (1:30)";
    }
},{
    desc: "Await reference fails in async function",
    code: "async function x() { return 1+await; }",
    pass: function (ex) {
        return !!ex.match(/\(1:3[05]\)/);
    }
},{
    desc: "{code} is an async FunctionDeclaration",
    code: "async /* a */ function x(){}",
    pass: isAsyncFnDecl
},{
    desc: "{code} is a reference to 'async' and a sync FunctionDeclaration",
    code: "async /*\n*/function x(){}",
    pass: isIdentThenFnDecl
},{
    desc: "{code} is a reference to 'async' and a sync FunctionDeclaration",
    code: "async /* a */\nfunction x(){}",
    pass: isIdentThenFnDecl
},{
    desc: "{code} is a reference to 'async' and a sync FunctionDeclaration",
    code: "async\nfunction x(){}",
    pass: isIdentThenFnDecl
},{
    desc: "{code} is a reference to 'async' and a sync FunctionDeclaration",
    code: "async //\nfunction x(){}",
    pass: isIdentThenFnDecl
},{
    desc: "{code} is a reference to 'async' and a sync FunctionDeclaration",
    code: "async /*\n*/\nfunction x(){}",
    pass: isIdentThenFnDecl
},
/* Extended syntax behaviour for Nodent */
{
    desc: "Async get method",
    code: "var a = {async get x(){}}",
    pass: function (ast) {
        return ast.body[0].declarations[0].init.properties[0].value.async;
    }
},{
    desc: "Async set method fails",
    code: "var a = {async set x(){}}",
    pass: function (ex) {
        return ex === "'set <member>(value)' cannot be be async (1:15)";
    }
},{
    desc: "Async constructor fails",
    code: "var a = {async constructor(){}}",
    pass: function (ex) {
        return ex === "'constructor()' cannot be be async (1:15)";
    }
},{
    /* Valid combinations of await options; none, just inAsyncFunction, or just awaitAnywhere */
    desc: "{code} is an AwaitExpression when inAsyncFunction option is true",
    code: "await(x)",
    options: {
        inAsyncFunction: true
    },
    pass: isExprType('AwaitExpression')
},{
    desc: "{code} is an AwaitExpression when inAsyncFunction option is true",
    code: "await x",
    options: {
        inAsyncFunction: true
    },
    pass: isExprType('AwaitExpression')
},{
    desc: "{code} is a CallExpression when awaitAnywhere option is true",
    code: "await(x)",
    options: {
        awaitAnywhere: true
    },
    pass: function(ast,sourceType) {
        return sourceType==='module'?ast==="'await' is reserved within modules (1:0)" :isExprType('CallExpression')(ast)
    }
},{
    desc: "{code} is an AwaitExpression when awaitAnywhere option is true",
    code: "await x",
    options: {
        awaitAnywhere: true
    },
    pass: isExprType('AwaitExpression')
},{
    desc: "{code} is a CallExpression when inAsyncFunction and awaitAnywhere option are false",
    code: "await(x)",
    pass: function(ast,sourceType) {
        return sourceType==='module'?ast==="'await' is reserved within modules (1:0)" :isExprType('CallExpression')(ast)
    }
},{
    desc: "{code} is a SyntaxError when inAsyncFunction and awaitAnywhere option are false",
    code: "await x",
    pass: function (ex, sourceType) {
        return sourceType==='module' ? ex === "'await' is reserved within modules (1:0)" : ex === "Unexpected token (1:6)";
    }
}];
var out = {
    true: "pass".green,
    false: "fail".red
};
var testNumber = +process.argv[2] || 0;
if (testNumber) {
    tests = [tests[testNumber - 1]];
} else {
    testNumber += 1;
}
var results = {
    true: 0,
    false: 0
};

tests.forEach(function (test, idx) {
    ['script','module'].forEach(function(scriptType){
        var code = test.code.replace(/\n/g, ' <linefeed> ');
        var desc = test.desc.replace('{code}', code.yellow);
        var pass = function () {
            var p = test.pass.apply(this, arguments);
            results[p] += 1;
            return p;
        };
        var prefix = idx + testNumber + " (" + scriptType + ", acorn v" + acorn.version+")\t" ;
        try {
            console.log(prefix, desc, out[pass(parse(test.code, test.options, scriptType),scriptType)]);
        } catch (ex) {
            try {
                console.log(prefix, desc, ex.message.cyan, out[pass(ex.message,scriptType)]);
            } catch (ex) {
                console.log(prefix, desc, ex.message.magenta, out[false]);
            }
        }
    });
}) ;
console.log('');
if (results.true)
    console.log((results.true + " of " + tests.length*2 + " tests passed").green);
if (results.false)
    console.log((results.false + " of " + tests.length*2 + " tests failed").red);
