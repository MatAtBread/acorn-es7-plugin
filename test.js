'use strict';

var acorn = require('acorn');
require('./')(acorn);
var estraverse = require('estraverse');
var xtend = require('xtend');
var assert = require('assert');


function find (type, ast, skip) {
  skip = skip || 0;
  var skipped = 0;

  var found;

  estraverse.traverse(ast, {
    enter: function (node) {
      if (found) {
        return estraverse.VisitorOption.Skip;
      }
      if (node.type == type) {
        if (skipped === skip) {
          found = node;
          return estraverse.VisitorOption.Skip;
        }
        skipped++;
      }
    }
  });

  if (!found) {
    throw new Error('did not find AwaitExpression (skipped ' + skipped + '/' + skip);
  }

  return found;
}

function extendOptions(pluginOptions, acornOptions) {
  return xtend({
    sourceType: 'module',
    ecmaVersion: 7,
    locations: true,
    ranges: true,
    plugins: {asyncawait: pluginOptions || pluginOptions !== false}
  }, acornOptions);
}

function parse(code, pluginOptions, acornOptions) {
  if (Array.isArray(code)) {
    code = code.join('\n');
  }
  var options = extendOptions(pluginOptions, acornOptions);
  return acorn.parse(code, options);
}


describe('async', function () {
  it('finds correct start location', function () {
    var node = find(
      'FunctionDeclaration',
      parse([
        'async function foo() {',
        '  x = await bar()',
        '}'
      ])
    );

    assert(node.async, 'function is async');

    assert.strictEqual(node.start, 0);

    assert.deepEqual(node.loc.start, {
      line: 1,
      column: 0
    });
  });

  it('finds correct end location', function () {
    var node = find(
      'FunctionDeclaration',
      parse([
        'async function foo() {',
        '  x = await bar()',
        '}'
      ])
    );

    assert.strictEqual(node.end, 42);

    assert.deepEqual(node.loc.end, {
      line: 3,
      column: 1
    });
  });
});


describe('await', function () {
  it('finds correct start location', function () {
    var node = find(
      'AwaitExpression',
      parse([
        'async function foo() {',
        '  x = await bar()',
        '}'
      ])
    );

    assert.strictEqual(node.start, 29);

    assert.deepEqual(node.loc.start, {
      line: 2,
      column: 6
    });
  });

  it('finds correct end location', function () {
    var node = find(
      'AwaitExpression',
      parse([
        'async function foo() {',
        '  x = await bar()',
        '}'
      ])
    );

    assert.strictEqual(node.end, 40);

    assert.deepEqual(node.loc.end, {
      line: 2,
      column: 17
    });
  });

  it('finds correct start location (awaitAnywhere)', function () {
    var node = find(
      'AwaitExpression',
      parse(
        'x = await bar()',
        {awaitAnywhere:true}
      )
    );

    assert.strictEqual(node.start, 4);

    assert.deepEqual(node.loc.start, {
      line: 1,
      column: 4
    });
  });

  it('finds correct end location (awaitAnywhere)', function () {
    var node = find(
      'AwaitExpression',
      parse(
        'x = await bar()',
        {awaitAnywhere:true}
      )
    );

    assert.strictEqual(node.end, 15);

    assert.deepEqual(node.loc.end, {
      line: 1,
      column: 15
    });
  });
});

