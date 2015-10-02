[![NPM](https://nodei.co/npm/acorn-es7-plugin.png?downloads=true&downloadRank=true)](https://nodei.co/npm/acorn-es7-plugin/)

acorn-es7-plugin
======

acorn-es7-plugin is a plugin for the [Acorn](https://github.com/marijnh/acorn) parser that generates ESTrees following the ['experimental' specification](https://github.com/estree/estree/blob/master/experimental/async-functions.md) for asynchronous functions.

	npm install --save acorn-es7-plugin
	
Usage
=====

Adding the plugin

	// Require acorn as usual
	var acorn = require("acorn");
	// Add the es7-plugin
	require('./acorn-es7-plugin')(acorn) ;
	
Using the plugin	

	var code = "async function x(){ return ; }\n";
	code += "await x(1);" ;
	
	var ast = acorn.parse(code,{
	// Specify use of the plugin
		plugins:{asyncawait:true},
	// Specify the ecmaVersion
		ecmaVersion:7
	}) ;
	// Show the AST
	console.log(JSON.stringify(ast,null,2)) ;
	
Compilance
==========
Some very helpful people pointed out in [this thread](https://github.com/marijnh/acorn/issues/309) that the parser plugin is not fully compliant with the language [proposal](https://tc39.github.io/ecmascript-asyncawait/).

In particular `async` and `await` are defined as 'contextual keywords' that are only 'keywords' in certain circumstances, but can be used as identifiers elsewhere. This plugin does not respect this distinction and use of identifiers called 'async' and 'await' will almost certainly fail to parse correctly. However, it is successfully in use in production environments and you may find the above restrictions easy to workaround in your project.

