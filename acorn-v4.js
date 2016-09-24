var asyncExit = /^async[\t ]+(return|throw)/ ;
var atomOrPropertyOrLabel = /^\s*[):;]/ ;
var removeComments = /([^\n])\/\*(\*(?!\/)|[^\n*])*\*\/([^\n])/g ;

function hasLineTerminatorBeforeNext(st, since) {
    return st.lineStart >= since;
}

function test(regex,st,noComment) {
    var src = st.input.slice(st.start) ;
    if (noComment) {
        src = src.replace(removeComments,"$1 $3") ;
    }
    return regex.test(src);
}

/* Return the object holding the parser's 'State'. This is different between acorn ('this')
 * and babylon ('this.state') */
function state(p) {
    if (('state' in p) && p.state.constructor && p.state.constructor.name==='State')
        return p.state ; // Probably babylon
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
    ['inFunction','inAsync','inGenerator','inModule'].forEach(function(k){
        if (k in src)
            dest[k] = src[k] ;
    }) ;
    p.nextToken();
    return p;
}

function asyncAwaitPlugin (parser,options){
    if (!options || typeof options !== "object")
        options = {} ;

    parser.extend("parse",function(base){
        return function(){
            this.inAsync = options.inAsyncFunction ;
            if (options.awaitAnywhere && options.inAsyncFunction)
                parser.raise(node.start,"The options awaitAnywhere and inAsyncFunction are mutually exclusive") ;

            return base.apply(this,arguments);
        }
    }) ;

    parser.extend("parseStatement",function(base){
        return function (declaration, topLevel) {
            var st = state(this) ;
            var start = st.start;
            var startLoc = st.startLoc;
            if (st.type.label==='name') {
                if ((options.asyncExits) && test(asyncExit,st)) {
                    // TODO: Ensure this function is itself nested in an async function or Method

                    /*if (st.inAsync) {
                        this.raise(start,"async return/throw only valid in function() within async function()") ;
                    }*/
                    this.next() ;

                    var r = this.parseStatement(declaration, topLevel) ;
                    r.async = true ;
                    r.start = start;
                    r.loc && (r.loc.start = startLoc);
                    r.range && (r.range[0] = start);
                    return r ;
                }
            }
            return base.apply(this,arguments);
        }
    }) ;

    parser.extend("parseIdent",function(base){
        return function(liberal) {
            if (this.options.sourceType==='module' && this.options.ecmaVersion >= 8 && options.awaitAnywhere)
                return base.call(this,true) ; // Force liberal mode if awaitAnywhere is set
            return base.apply(this,arguments) ;
        }
    }) ;

    parser.extend("parseExprAtom",function(base){
        var NotAsync = {};
        return function(refShorthandDefaultPos){
            var st = state(this) ;
            var start = st.start ;
            var startLoc = st.startLoc;

            var rhs,r = base.apply(this,arguments);

            if (r.type==='Identifier') {
                if (r.name==='await' && !st.inAsync) {
                    if (options.awaitAnywhere) {
                        var n = this.startNodeAt(r.start, r.loc && r.loc.start);

                        start = st.start ;

                        var parseHooks = {
                            raise:function(){
                                try {
                                    return pp.raise.apply(this,arguments) ;
                                } catch(ex) {
                                    throw /*inBody?ex:*/NotAsync ;
                                }
                            }
                        } ;

                        try {
                            rhs = subParse(this,start-4,parseHooks).parseExprSubscripts() ;
                            if (rhs.end<=start) {
                                rhs = subParse(this,start,parseHooks).parseExprSubscripts() ;
                                n.argument = rhs ;
                                n = this.finishNodeAt(n,'AwaitExpression', rhs.end, rhs.loc && rhs.loc.end) ;
                                st.pos = rhs.end;
                                this.end = rhs.end ;
                                this.endLoc = rhs.endLoc ;
                                this.next();
                                return n ;
                            }
                        } catch (ex) {
                            if (ex===NotAsync)
                                return r ;
                            throw ex ;
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
            if (key.type === "Identifier" && key.name === "async" && !hasLineTerminatorBeforeNext(st, key.end)) {
                // Look-ahead to see if this is really a property or label called async or await
                if (!st.input.slice(key.end).match(atomOrPropertyOrLabel)){
                    st.__isAsyncProp = true ;
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

    parser.extend("parseFunctionBody",function(base){
        return function (node, isArrowFunction) {
            var st = state(this) ;
            var wasAsync = st.inAsync ;
            if (st.__isAsyncProp) {
                node.async = true ;
                st.inAsync = true ;
                delete st.__isAsyncProp ;
            }
            var r = base.apply(this,arguments) ;
            st.inAsync = wasAsync ;
            return r ;
        }
    }) ;
}

module.exports = asyncAwaitPlugin ;
