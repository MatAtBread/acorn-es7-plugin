var NotAsync = {} ;
var asyncExit = /^async[\t ]+(return|throw)/ ;
var asyncFunction = /^async[\t ]+function/ ;

/* Create a new parser derived from the specified parser, so that in the
 * event of an error we can back out and try again */
function subParse(parser, how, pos, extensions) {
	var p = new parser.constructor(parser.options, parser.input, pos);
	if (extensions)
		for (var k in extensions)
			p[k] = extensions[k] ;

	p.inFunction = parser.inFunction ;
	p.inAsyncFunction = parser.inAsyncFunction ;
	p.inGenerator = parser.inGenerator ;
	p.inModule = parser.inModule ;
	p.nextToken();
	return p[how]();
}

function asyncAwaitPlugin (parser,options){
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

	parser.extend("parseStatement",function(base){
		return function (declaration, topLevel) {
			if (this.type.label==='name') {
				if (asyncFunction.test(this.input.slice(this.start))) {
					var wasAsync = this.inAsyncFunction ;
					try {
						this.inAsyncFunction = true ;
						this.next() ;
						var r = this.parseStatement(declaration, topLevel) ;
						r.async = true ;
						return r ;
					} finally {
						this.inAsyncFunction = wasAsync ;
					}
				} else if ((typeof options==="object" && options.asyncExits) && asyncExit.test(this.input.slice(this.start))) {
					// NON-STANDARD EXTENSION iff. options.asyncExits is set, the 
					// extensions 'async return <expr>?' and 'async throw <expr>?'
					// are enabled. In each case they are the standard ESTree nodes
					// with the flag 'async:true'
					this.next() ;
					var r = this.parseStatement(declaration, topLevel) ;
					r.async = true ;
					return r ;
				}
			}
			return base.apply(this,arguments);
		}	
	}) ;

	parser.extend("parseExprAtom",function(base){
		return function(refShorthandDefaultPos){
			var start = this.start ;
			var rhs,r = base.apply(this,arguments);
			if (r.type==='Identifier') {
				if (r.name==='async' && !/^async[\t ]*\n/.test(this.input.slice(start))) {
					// Is this really an async function?
					var isAsync = this.inAsyncFunction ;
					try {
						this.inAsyncFunction = true ;
						var pp = this ;
						var inBody = false ;
						rhs = subParse(this,'parseExpression',this.start,{
							parseFunctionBody:function(){
								try {
									var wasInBody = inBody ;
									inBody = true ;
									return pp.parseFunctionBody.apply(this,arguments) ;
								} finally {
									inBody = wasInBody ;
								}
							},
							raise:function(){
								try {
									return pp.raise.apply(this,arguments) ;
								} catch(ex) {
									throw inBody?ex:NotAsync ;
								}
							}
						}) ;
						if (rhs.type==='SequenceExpression')
							rhs = rhs.expressions[0] ;
						if (rhs.type==='FunctionExpression' || rhs.type==='FunctionDeclaration' || rhs.type==='ArrowFunctionExpression') {
							rhs.async = true ;
							this.pos = rhs.end ;
							this.next();
							es7check(rhs) ;
							return rhs ;
						}
					} catch (ex) {
						if (ex!==NotAsync)
							throw ex ;
					}
					finally {
						this.inAsyncFunction = isAsync ;
					}
				}
				else if (r.name==='await') {
					var n = this.startNode() ;
					if (this.inAsyncFunction) {
						rhs = this.parseExprSubscripts() ;
						n.operator = 'await' ;
						n.argument = rhs ;
						n = this.finishNodeAt(n,'AwaitExpression', rhs.end, rhs.loc) ;
						es7check(n) ;
						return n ;
					} else 
						// NON-STANDARD EXTENSION iff. options.awaitAnywhere is true,
						// an 'AwaitExpression' is allowed anywhere the token 'await'
						// could not be an identifier with the name 'await'.
						if (typeof options==="object" && options.awaitAnywhere) {
							var start = this.start ;
							rhs = subParse(this,'parseExprSubscripts',this.start-4) ;
							if (rhs.end<=start) {
								rhs = subParse(this,'parseExprSubscripts',this.start) ;
								n.operator = 'await' ;
								n.argument = rhs ;
								n = this.finishNodeAt(n,'AwaitExpression', rhs.end, rhs.loc) ;
								this.pos = rhs.end ;
								this.next();
								es7check(n) ;
								return n ;
							}
						}
				}
			}
			return r ;
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

module.exports = function(acorn) {
	acorn.plugins.asyncawait = asyncAwaitPlugin ;
}
