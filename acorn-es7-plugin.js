var NotAsync = {} ;
var asyncExit = /^async[\t ]+(return|throw)/ ;
var asyncFunction = /^async[\t ]+function/ ;
var atomOrPropertyOrLabel = /^\s*[:;]/ ;
var asyncAtEndOfLine = /^async[\t ]*\n/ ;

/* Return the object holding the parser's 'State'. This is different between acorn ('this')
 * and babylon ('this.state')
 */
function state(p) {
	if (p.state && p.state.constructor.name==='State') // Probably babylon
		return p.state ;
	return p ; // Probably acorn
}

/* Create a new parser derived from the specified parser, so that in the
 * event of an error we can back out and try again */
function subParse(parser, pos, extensions) {
	// NB: The Babylon constructor does NOT expect 'pos' as an argument, and so 
	// the input needs truncation at the start position, however at present
	// this doesn't work nicely as all the node location/start/end values
	// are therefore offset. Consequently, this plug-in is NOT currently working 
	// with the (undocumented) Babylon plug-in interface. 
	var p = new parser.constructor(parser.options, parser.input, pos);
	if (extensions)
		for (var k in extensions)
			p[k] = extensions[k] ;

	var src = state(parser) ;
	var dest = state(p) ;
	['inFunction','inAsyncFunction','inAsync','inGenerator','inModule'].forEach(function(k){
		if (k in src)
			dest[k] = src[k] ;
	}) ;
	p.nextToken();
	return p;
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
			var st = state(this) ;
			if (st.type.label==='name') {
				if (asyncFunction.test(st.input.slice(st.start))) {
					var wasAsync = st.inAsyncFunction ;
					try {
						st.inAsyncFunction = true ;
						this.next() ;
						var r = this.parseStatement(declaration, topLevel) ;
						r.async = true ;
						return r ;
					} finally {
						st.inAsyncFunction = wasAsync ;
					}
				} else if ((typeof options==="object" && options.asyncExits) && asyncExit.test(st.input.slice(st.start))) {
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
			var st = state(this) ;
			var start = st.start ;
			var rhs,r = base.apply(this,arguments);
			if (r.type==='Identifier') {
				if (r.name==='async' && !asyncAtEndOfLine.test(st.input.slice(start))) {
					// Is this really an async function?
					var isAsync = st.inAsyncFunction ;
					try {
						st.inAsyncFunction = true ;
						var pp = this ;
						var inBody = false ;
						
						var parseHooks = {
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
						} ;
						
						start = st.start ;
						rhs = subParse(this,start,parseHooks).parseExpression() ;
						if (rhs.type==='SequenceExpression')
							rhs = rhs.expressions[0] ;
						if (rhs.type==='FunctionExpression' || rhs.type==='FunctionDeclaration' || rhs.type==='ArrowFunctionExpression') {
							rhs.async = true ;
							st.pos = rhs.end; //+start ;
							this.next();
							es7check(rhs) ;
							return rhs ;
						}
					} catch (ex) {
						if (ex!==NotAsync)
							throw ex ;
					}
					finally {
						st.inAsyncFunction = isAsync ;
					}
				}
				else if (r.name==='await') {
					var n = this.startNode() ;
					if (st.inAsyncFunction) {
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

						// Look-ahead to see if this is really a property or label called async or await
						if (st.input.slice(r.end).match(atomOrPropertyOrLabel))
							return r ; // This is a valid property name or label

						if (typeof options==="object" && options.awaitAnywhere) {
							start = st.start ;
							rhs = subParse(this,start-4).parseExprSubscripts() ;
							if (rhs.end<=start) {
								rhs = subParse(this,start).parseExprSubscripts() ;
								n.operator = 'await' ;
								n.argument = rhs ;
								n = this.finishNodeAt(n,'AwaitExpression', rhs.end, rhs.loc) ;
								st.pos = rhs.end;//+start ;
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
			var st = state(this) ;
			var key = base.apply(this,arguments) ;
			if (key.type === "Identifier" && key.name === "async") {
				// Look-ahead to see if this is really a property or label called async or await
				if (!st.input.slice(key.end).match(atomOrPropertyOrLabel)){
					es7check(prop) ;
					prop.async = true ;
					key = base.apply(this,arguments) ;
					if (key.type==='Identifier') {
						if (key.name==='constructor')
							this.raise(key.start,"'constructor()' cannot be be async") ;
						else if (key.name==='set')
							this.raise(key.start,"'set <member>(value)' cannot be be async") ;
					}
				}
			}
			return key;
		};
	}) ;
}

module.exports = function(acorn) {
	acorn.plugins.asyncawait = asyncAwaitPlugin ;
}
