import { readFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import { z } from 'zod';
import assert from 'node:assert/strict';

// Exercise the actual form schemas, including after resolver/Zod upgrades,
// without importing JSX components or depending on a browser environment.
const generate = generateModule.default || generateModule;
const ast = parse(await readFile(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
const schemas = ast.program.body.filter((node) => node.type === 'VariableDeclaration' && node.declarations.some((declaration) => ['loginSchema', 'studentSchema'].includes(declaration.id.name)));
const { loginSchema, studentSchema } = new Function('z', `${schemas.map((node) => generate(node).code).join('\n')}; return {loginSchema, studentSchema};`)(z);
for (const role of ['student', 'counselor', 'admin']) {
  assert.equal(loginSchema.safeParse({ role, phone: '0771234567', email: '', password: 'ValidPassword12' }).success, true);
  assert.equal(loginSchema.safeParse({ role, phone: '', email: 'account@example.com', password: 'ValidPassword12' }).success, true);
  assert.equal(loginSchema.safeParse({ role, phone: '', email: '', password: 'ValidPassword12' }).success, false);
}
assert.equal(studentSchema.safeParse({ firstName: 'Test', lastName: 'Student', phone: '+15551234567', email: '', country: 'United States', county: 'Virginia', schoolName: 'Test School', gradeLevel: 10, password: 'ValidPassword12' }).success, true);
console.log('Login form schema checks passed: phone-only, email-only, required identifier, and international registration.');
