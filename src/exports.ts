import ts from 'typescript';

export interface ExportedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'enum' | 'namespace' | 're-export' | 're-export-all' | 'assignment';
  line: number;
  localName?: string;
  source?: string;
}

function modifiers(node: ts.Node): readonly ts.Modifier[] {
  return ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
}
function hasExport(node: ts.Node) { return modifiers(node).some(item => item.kind === ts.SyntaxKind.ExportKeyword); }
function hasDefault(node: ts.Node) { return modifiers(node).some(item => item.kind === ts.SyntaxKind.DefaultKeyword); }
function bindings(name: ts.BindingName, output: string[]) {
  if (ts.isIdentifier(name)) output.push(name.text);
  else for (const element of name.elements) if (!ts.isOmittedExpression(element)) bindings(element.name, output);
}

/** Collect syntax-declared exports without resolving aliases or implying runtime reachability. */
export function collectExports(source: ts.SourceFile): ExportedSymbol[] {
  const found: ExportedSymbol[] = [];
  const add = (node: ts.Node, name: string, kind: ExportedSymbol['kind'], extra: Pick<ExportedSymbol, 'localName' | 'source'> = {}) => {
    found.push({ name, kind, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, ...extra });
  };
  for (const statement of source.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      const sourceName = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined;
      if (!clause) add(statement, '*', 're-export-all', sourceName === undefined ? {} : { source: sourceName });
      else if (ts.isNamespaceExport(clause)) add(statement, clause.name.text, 're-export-all', sourceName === undefined ? {} : { source: sourceName });
      else for (const element of clause.elements) {
        const exported = element.name.text, localName = element.propertyName?.text ?? exported;
        add(statement, exported, 're-export', { ...(localName !== exported ? { localName } : {}), ...(sourceName === undefined ? {} : { source: sourceName }) });
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      add(statement, '=', 'assignment', { localName: statement.expression.getText(source) });
      continue;
    }
    if (!hasExport(statement)) continue;
    const isDefault = hasDefault(statement);
    const declaredName = (name: string, kind: ExportedSymbol['kind']) => add(statement, isDefault ? 'default' : name, kind, isDefault && name !== 'default' ? { localName: name } : {});
    if (ts.isFunctionDeclaration(statement)) declaredName(statement.name?.text ?? 'default', 'function');
    else if (ts.isClassDeclaration(statement)) declaredName(statement.name?.text ?? 'default', 'class');
    else if (ts.isInterfaceDeclaration(statement)) declaredName(statement.name.text, 'interface');
    else if (ts.isTypeAliasDeclaration(statement)) declaredName(statement.name.text, 'type');
    else if (ts.isEnumDeclaration(statement)) declaredName(statement.name.text, 'enum');
    else if (ts.isModuleDeclaration(statement)) declaredName(statement.name.getText(source).replace(/^['"]|['"]$/g, ''), 'namespace');
    else if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      const names: string[] = []; bindings(declaration.name, names); for (const name of names) declaredName(name, 'variable');
    }
  }
  return found.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind));
}
