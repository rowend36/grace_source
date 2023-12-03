var  antlr4ts = require("antlr4ts");
var  JavaLexer = require("java-ast/dist/parser/JavaLexer");
var  JavaParser = require("java-ast/dist/parser/JavaParser");
/**
 * Parses the given source code and returns the AST
 * @param source Java source code to parse
 */
function parse(source,listener) {
    const chars = new antlr4ts.ANTLRInputStream(source);
    const lexer = new JavaLexer.JavaLexer(chars);
    const tokens = new antlr4ts.CommonTokenStream(lexer);
    const parser = new JavaParser.JavaParser(tokens);
    parser.buildParseTrees = false;
    parser.removeErrorListeners();
    lexer.removeErrorListeners();
    lexer.addErrorListener(listener);
    parser.addErrorListener(listener);
    parser.compilationUnit();
}
exports.parse = parse;
