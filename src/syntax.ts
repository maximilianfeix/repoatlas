import type * as ts from 'typescript';
import type { Edge } from './types.js';

type Compiler=typeof import('typescript');
type StaticHandler=(literal:ts.StringLiteralLike,node:ts.Node,kind:Edge['kind'])=>void;
type ComputedHandler=(expression:ts.Expression,node:ts.Node,kind:Edge['kind'])=>void;

function bindingHasName(compiler:Compiler,binding:ts.BindingName,name:string):boolean {
  if(compiler.isIdentifier(binding))return binding.text===name;
  return binding.elements.some(element=>!compiler.isOmittedExpression(element)&&bindingHasName(compiler,element.name,name));
}
function isAmbientDeclaration(compiler:Compiler,node:ts.Node):boolean {
  return (compiler.getCombinedModifierFlags(node as ts.Declaration)&compiler.ModifierFlags.Ambient)!==0;
}
function statementDeclaresRequire(compiler:Compiler,statement:ts.Statement):boolean {
  if(isAmbientDeclaration(compiler,statement))return false;
  if(compiler.isVariableStatement(statement))return statement.declarationList.declarations.some(declaration=>bindingHasName(compiler,declaration.name,'require'));
  if((compiler.isFunctionDeclaration(statement)||compiler.isClassDeclaration(statement)||compiler.isModuleDeclaration(statement)||compiler.isEnumDeclaration(statement))&&statement.name?.text==='require')return true;
  if(compiler.isImportEqualsDeclaration(statement))return !statement.isTypeOnly&&statement.name.text==='require';
  if(compiler.isImportDeclaration(statement)&&statement.importClause){
    const clause=statement.importClause;
    return !clause.isTypeOnly&&(clause.name?.text==='require'||(clause.namedBindings!==undefined&&(compiler.isNamespaceImport(clause.namedBindings)?clause.namedBindings.name.text==='require':clause.namedBindings.elements.some(element=>!element.isTypeOnly&&element.name.text==='require'))));
  }
  return false;
}
function statementsDeclareRequire(compiler:Compiler,statements:readonly ts.Statement[]):boolean {
  return statements.some(statement=>statementDeclaresRequire(compiler,statement));
}
const functionVarCache=new WeakMap<ts.Node,boolean>();
function isRequireShadowed(compiler:Compiler,call:ts.CallExpression):boolean {
  function hasFunctionVar(scope:ts.Node):boolean {
    const cached=functionVarCache.get(scope);if(cached!==undefined)return cached;
    let found=false;
    function visit(node:ts.Node){
      if(found||(node!==scope&&(compiler.isFunctionLike(node)||compiler.isClassLike(node))))return;
      if(compiler.isVariableDeclarationList(node)&&(node.flags&compiler.NodeFlags.BlockScoped)===0&&!isAmbientDeclaration(compiler,node.parent)&&node.declarations.some(declaration=>bindingHasName(compiler,declaration.name,'require'))){found=true;return;}
      compiler.forEachChild(node,visit);
    }
    visit(scope);functionVarCache.set(scope,found);return found;
  }
  for(let scope:ts.Node|undefined=call.parent;scope;scope=scope.parent){
    if(compiler.isFunctionLike(scope)){
      if(scope.parameters.some(parameter=>bindingHasName(compiler,parameter.name,'require'))||(scope.name&&compiler.isIdentifier(scope.name)&&scope.name.text==='require'))return true;
      if('body'in scope&&scope.body&&hasFunctionVar(scope.body))return true;
    }
    if(compiler.isBlock(scope)&&statementsDeclareRequire(compiler,scope.statements))return true;
    if(compiler.isSourceFile(scope)&&statementsDeclareRequire(compiler,scope.statements))return true;
    if(compiler.isModuleBlock(scope)&&statementsDeclareRequire(compiler,scope.statements))return true;
    if(compiler.isCaseBlock(scope)&&scope.clauses.some(clause=>statementsDeclareRequire(compiler,clause.statements)))return true;
    if(compiler.isCatchClause(scope)&&scope.variableDeclaration&&bindingHasName(compiler,scope.variableDeclaration.name,'require'))return true;
    if(compiler.isForStatement(scope)&&scope.initializer&&compiler.isVariableDeclarationList(scope.initializer)&&scope.initializer.declarations.some(declaration=>bindingHasName(compiler,declaration.name,'require')))return true;
    if((compiler.isForInStatement(scope)||compiler.isForOfStatement(scope))&&compiler.isVariableDeclarationList(scope.initializer)&&scope.initializer.declarations.some(declaration=>bindingHasName(compiler,declaration.name,'require')))return true;
  }
  return false;
}

/** Share exact TypeScript import syntax extraction between the CLI and browser analyzer. */
export function visitModuleDependencies(compiler:Compiler,source:ts.SourceFile,onStatic:StaticHandler,onComputed:ComputedHandler):void {
  function visit(node:ts.Node){
    if(compiler.isImportDeclaration(node)&&compiler.isStringLiteral(node.moduleSpecifier))onStatic(node.moduleSpecifier,node,node.importClause?.isTypeOnly?'type':'import');
    else if(compiler.isExportDeclaration(node)&&node.moduleSpecifier&&compiler.isStringLiteral(node.moduleSpecifier))onStatic(node.moduleSpecifier,node,node.isTypeOnly?'type':'export');
    else if(compiler.isImportEqualsDeclaration(node)&&compiler.isExternalModuleReference(node.moduleReference)&&node.moduleReference.expression&&compiler.isStringLiteral(node.moduleReference.expression))onStatic(node.moduleReference.expression,node,'require');
    else if(compiler.isImportTypeNode(node)&&compiler.isLiteralTypeNode(node.argument)&&compiler.isStringLiteral(node.argument.literal))onStatic(node.argument.literal,node,'type');
    else if(compiler.isCallExpression(node)&&node.arguments[0]&&(node.expression.kind===compiler.SyntaxKind.ImportKeyword||(compiler.isIdentifier(node.expression)&&node.expression.text==='require'&&!isRequireShadowed(compiler,node)))){
      const kind=node.expression.kind===compiler.SyntaxKind.ImportKeyword?'dynamic':'require';
      if(compiler.isStringLiteralLike(node.arguments[0]))onStatic(node.arguments[0],node,kind);
      else onComputed(node.arguments[0],node,kind);
    }
    compiler.forEachChild(node,visit);
  }
  visit(source);
}
