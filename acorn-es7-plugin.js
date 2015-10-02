module.exports = function(acorn) { 
	var tokens = {
		async:new acorn.TokenType("async",{beforeExpr: true, prefix: true, startsExpr: true, keyword: "async"}),
		await:new acorn.TokenType("await",{beforeExpr: true, prefix: true, startsExpr: true, keyword: "await"})
	} ;

	acorn.plugins.asyncawait = function(parser,options){
		var es7check = function(){} ;

		parser.extend("initialContext",function(base){
			return function(){
				if (this.options.ecmaVersion < 7) {
					es7check = function(node) {
						parser.raise(node.start,"async/await keywords only available when ecmaVersion>=7") ;
					} ;
				}
				return base.apply(this,arguments);
			}
		}) ;

		parser.extend("finishNode",function(base){
			return function(node,type){
				ret = base.call(this,node,type);
				if (typeof options==="object" && options.asyncExits 
						&& (type==='ReturnStatement' || type==='ThrowStatement')) {
					if (node.argument && node.argument.operator==='async') {
						node.argument = node.argument.argument ;
						node.async = true ;
					}
				} 
				if (type==='UnaryExpression' && node.operator==='await') {
					es7check(node) ;
					node.type = 'AwaitExpression' ;
				}
				if (type==='UnaryExpression' && node.operator==='async') {
					es7check(node) ;
					if (!node.argument.async && (node.argument.type==='FunctionDeclaration' || 
							node.argument.type==='FunctionExpression' || 
							node.argument.type==='ArrowFunctionExpression')) {
						var fn = node.argument ;
						delete node.argument ;
						delete node.operator ;
						delete node.prefix ;
						node.async = true ;
						Object.keys(fn).forEach(function(k){
							if (k!=='start')
								node[k] = fn[k] ;
						}) ;
					}
					if (node.argument.type==='SequenceExpression') {
						// This is a mis-parsed function call to 'async(...)'. Fix it
						node.type = 'CallExpression';
						node.callee = {type:'Identifier',name:'async',start:node.start,end:node.end,loc:node.loc} ;
						node.arguments = node.argument.expressions ;
						delete node.argument ;
						delete node.operator ;
						delete node.prefix ;
					}
				}
				if (type==='ExpressionStatement' && node.expression.type==='FunctionExpression' && node.expression.async) {
					es7check(node) ;
					var fn = node.expression ;
					fn.type = 'FunctionDeclaration' ;
					delete node.expression ;
					Object.keys(fn).forEach(function(k){
						if (k!=='start')
							node[k] = fn[k] ;
					}) ;
				} 
				return ret ;
			}
		}) ;

		parser.extend("finishToken",function(base){
			return function(type,val){
				type = type || (tokens.hasOwnProperty(val) && tokens[val]) ;
				return base.call(this,type,val);
			}
		}) ;

		parser.extend("isKeyword",function(base){
			return function(str){
				if (str==="async") {
					this.potentialArrowAt = this.start+str.length+1 ;
					return true ;
				}
				return tokens.hasOwnProperty(str) || base.apply(this,arguments);
			}
		}) ;

		parser.extend("isReservedWord",function(base){
			return function(str){
				return tokens.hasOwnProperty(str) || base.apply(this,arguments);
			}
		}) ;

		parser.extend("parsePropertyName",function(base){
			return function (prop) {
				var key = base.apply(this,arguments) ;
				if (key.type === "Identifier" && key.name === "async") {
					es7check(prop) ;
					prop.async = true ;
					key = base.apply(this,arguments) ;
				}
				return key;
			};
		}) ;
	}
}
