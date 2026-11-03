// Generates asynchronous PostgreSQL routes from the legacy route definitions.
// Original SQLite routes remain available only for local migration regression tests.
// Generated output is deterministic and syntax/endpoint-tested before deployment.
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'generated');
fs.mkdirSync(output, { recursive: true });

for (const filename of fs.readdirSync(path.join(root, 'routes')).filter((name) => name.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(root, 'routes', filename), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module' });
  const prepared = new Set();
  const transactions = new Set();
  const asyncNames = new Set();
  const mapped = new WeakSet();
  traverse(ast, {
    ImportDeclaration(p) {
      if (p.node.source.value === '../db/init.js') p.node.source.value = '../db/postgres.js';
      if (p.node.source.value === '../middleware/auth.js') p.node.source.value = '../middleware/pg-auth.js';
      if (p.node.source.value === 'bcrypt') p.node.source.value = 'bcryptjs';
    },
    VariableDeclarator(p) {
      if (!t.isIdentifier(p.node.id)) return;
      const init = p.node.init;
      if (t.isCallExpression(init) && t.isMemberExpression(init.callee) && t.isIdentifier(init.callee.object, { name: 'db' })) {
        if (t.isIdentifier(init.callee.property, { name: 'prepare' })) prepared.add(p.node.id.name);
        if (t.isIdentifier(init.callee.property, { name: 'transaction' })) transactions.add(p.node.id.name);
      }
    },
  });
  const isDatabaseCall = (node) => {
    const callee = node.callee;
    if (t.isIdentifier(callee)) return transactions.has(callee.name) || asyncNames.has(callee.name);
    if (t.isCallExpression(callee) && t.isMemberExpression(callee.callee) && t.isIdentifier(callee.callee.object, { name: 'db' }) && t.isIdentifier(callee.callee.property, { name: 'transaction' })) return true;
    if (!t.isMemberExpression(callee) || !['get', 'all', 'run'].includes(callee.property.name)) return false;
    if (t.isIdentifier(callee.object)) return prepared.has(callee.object.name);
    return t.isCallExpression(callee.object) && t.isMemberExpression(callee.object.callee) && t.isIdentifier(callee.object.callee.object, { name: 'db' }) && t.isIdentifier(callee.object.callee.property, { name: 'prepare' });
  };
  // Fixed-point propagation accounts for local helpers such as allocations().
  for (let pass = 0; pass < 8; pass++) {
    traverse(ast, {
      CallExpression: { exit(p) {
        if (!isDatabaseCall(p.node) || p.parentPath.isAwaitExpression()) return;
        const fn = p.getFunctionParent();
        if (fn) {
          fn.node.async = true;
          if (t.isFunctionDeclaration(fn.node)) asyncNames.add(fn.node.id.name);
          if (fn.parentPath.isVariableDeclarator()) asyncNames.add(fn.parentPath.node.id.name);
        }
        p.replaceWith(t.awaitExpression(p.node));
      } },
    });
    traverse(ast, {
      CallExpression: { exit(p) {
        if (!t.isMemberExpression(p.node.callee)) return;
        const name = p.node.callee.property.name;
        const callback = p.node.arguments[0];
        if (!['map', 'forEach'].includes(name) || !callback?.async) return;
        const fn = p.getFunctionParent();
        if (fn) { fn.node.async = true; if (t.isFunctionDeclaration(fn.node)) asyncNames.add(fn.node.id.name); }
        if (name === 'map') {
          if (mapped.has(p.node)) return;
          mapped.add(p.node);
          const wrapped = t.awaitExpression(t.callExpression(t.memberExpression(t.identifier('Promise'), t.identifier('all')), [p.node]));
          p.replaceWith(wrapped);
          p.skip();
        } else {
          // Keep writes sequential, especially within transactions.
          if (!p.parentPath.isExpressionStatement()) throw new Error(`Unsupported forEach in ${filename}`);
          const entries = t.callExpression(t.memberExpression(p.node.callee.object, t.identifier('entries')), []);
          const index = callback.params[1] || p.scope.generateUidIdentifier('index');
          const value = callback.params[0];
          const body = t.isBlockStatement(callback.body) ? callback.body : t.blockStatement([t.expressionStatement(callback.body)]);
          p.parentPath.replaceWith(t.forOfStatement(t.variableDeclaration('const', [t.variableDeclarator(t.arrayPattern([index, value]))]), entries, body));
        }
      } },
    });
  }
  if (['users.js', 'posts.js', 'messages.js', 'groups.js'].includes(filename)) {
    const kind = { 'users.js': 'profile', 'posts.js': 'post', 'messages.js': 'message', 'groups.js': 'group' }[filename];
    ast.program.body.unshift(t.importDeclaration([t.importSpecifier(t.identifier('createUpload'), t.identifier('createUpload'))], t.stringLiteral('../services/uploads.js')));
    traverse(ast, { VariableDeclarator(p) { if (t.isIdentifier(p.node.id, { name: 'upload' })) p.node.init = t.callExpression(t.identifier('createUpload'), [t.stringLiteral(kind)]); } });
  }
  const code = generate(ast, { comments: true }).code;
  traverse(ast, { CallExpression(p) {
    if (isDatabaseCall(p.node) && !p.parentPath.isAwaitExpression()) throw new Error(`Unawaited database operation in ${filename}`);
  } });
  parser.parse(code, { sourceType: 'module' });
  fs.writeFileSync(path.join(output, filename), `// Generated by scripts/generate-postgres-routes.cjs — do not edit.\n${code}\n`);
}
console.log('Generated asynchronous PostgreSQL routes.');

// Generate the initial schema without importing or executing SQLite/native code.
const initialization = parser.parse(fs.readFileSync(path.join(root, 'db/init.js'), 'utf8'), { sourceType: 'module' });
const schema = [];
let quizSeed;
traverse(initialization, {
  CallExpression(p) {
    const call = p.node;
    if (!t.isMemberExpression(call.callee) || !t.isIdentifier(call.callee.object, { name: 'db' }) || !t.isIdentifier(call.callee.property, { name: 'exec' })) return;
    const arg = call.arguments[0];
    const sql = t.isTemplateLiteral(arg) && arg.expressions.length === 0 ? arg.quasis[0].value.cooked : t.isStringLiteral(arg) ? arg.value : '';
    if (!sql?.trim().startsWith('CREATE TABLE')) return;
    schema.push(sql.trim().replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY').replace(/\bDATETIME\b/gi, 'TEXT').replace(/\bBOOLEAN\b/gi, 'INTEGER').replace(/;?$/, ';'));
  },
  VariableDeclarator(p) {
    if (t.isIdentifier(p.node.id, { name: 'questions' }) && t.isArrayExpression(p.node.init)) quizSeed = generate(p.node.init).code;
  },
});
fs.writeFileSync(path.join(output, 'schema.sql'), schema.join('\n\n'));
fs.writeFileSync(path.join(output, 'assessment-seed.js'), `export const questions = ${quizSeed};\n`);
