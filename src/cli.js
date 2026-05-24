#!/usr/bin/env node
import fs from 'node:fs';

const VERSION = '0.1.0';
const args = process.argv.slice(2);
function has(flag) { return args.includes(flag); }
function usage() {
  console.log(`api-contract-diff v${VERSION}

Usage:
  api-contract-diff <old.json|old.yaml> <new.json|new.yaml> [--json] [--fail-on-breaking]

Options:
  --config <file>       Read JSON config. Default: .api-contract-diff.json when present.
  --ignore <path>       Ignore a flattened path. Can be repeated.
  --fail-on-breaking    Exit 2 when breaking changes are found.
  --json                Print JSON.
  --version             Print version.

Compares OpenAPI/Swagger-style JSON/YAML or generic JSON/YAML shapes.`);
}
if (has('--help') || has('-h')) { usage(); process.exit(0); }
if (has('--version')) { console.log(VERSION); process.exit(0); }
if (args.filter((a) => !a.startsWith('-')).length < 2) { usage(); process.exit(1); }
const jsonOut = has('--json');
const failOnBreaking = has('--fail-on-breaking');
const [oldFile, newFile] = args.filter((a) => !a.startsWith('-'));
function readConfig() {
  const configIndex = args.indexOf('--config');
  const configFile = configIndex >= 0 ? args[configIndex + 1] : fs.existsSync('.api-contract-diff.json') ? '.api-contract-diff.json' : '';
  if (!configFile) return {};
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  } catch (error) {
    console.error(`Unable to read config ${configFile}: ${error.message}`);
    process.exit(1);
  }
}
const config = readConfig();
const ignores = [
  ...(config.ignore || []),
  ...args.flatMap((arg, index) => arg === '--ignore' ? [args[index + 1]] : []).filter(Boolean)
];
function ignored(item) {
  return ignores.some((prefix) => item.path === prefix || item.path.startsWith(`${prefix}.`) || item.path.startsWith(`${prefix} `));
}
let oldDoc;
let newDoc;
try {
  oldDoc = readStructured(oldFile);
  newDoc = readStructured(newFile);
} catch (error) {
  console.error(`Unable to read contract: ${error.message}`);
  process.exit(1);
}
const methods = new Set(['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace']);
function openApiOps(doc) {
  const ops = new Map();
  for (const [route, methodsObj] of Object.entries(doc.paths || {})) {
    for (const [method, op] of Object.entries(methodsObj || {})) {
      if (methods.has(method.toLowerCase())) ops.set(`${method.toUpperCase()} ${route}`, op || {});
    }
  }
  return ops;
}
function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/^['"]|['"]$/g, '');
}
function parseSimpleYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].value;
    const match = line.match(/^([^:]+):(.*)$/);
    if (!match) continue;
    const key = match[1].trim().replace(/^['"]|['"]$/g, '');
    const rest = match[2].trim();
    if (!rest) {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else if (rest.startsWith('[') || rest.startsWith('{')) {
      try { parent[key] = JSON.parse(rest.replace(/'/g, '"')); } catch { parent[key] = parseScalar(rest); }
    } else {
      parent[key] = parseScalar(rest);
    }
  }
  return root;
}
function readStructured(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.ya?ml$/i.test(file)) return parseSimpleYaml(text);
  return JSON.parse(text);
}
function responseCodes(op) {
  return new Set(Object.keys(op.responses || {}));
}
function requiredSet(schema) {
  return new Set(Array.isArray(schema?.required) ? schema.required : []);
}
function schemaProps(schema) {
  return schema?.properties && typeof schema.properties === 'object' ? schema.properties : {};
}
function flatten(value, prefix = '$') {
  const out = new Map();
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  out.set(prefix, type);
  if (value && typeof value === 'object') {
    const entries = Array.isArray(value) ? Object.entries(value.slice(0, 1)) : Object.entries(value);
    for (const [key, child] of entries) {
      const next = Array.isArray(value) ? `${prefix}[]` : `${prefix}.${key}`;
      for (const [p, t] of flatten(child, next).entries()) out.set(p, t);
    }
  }
  return out;
}
const breaking = [];
const warnings = [];
const additive = [];
const oldOps = openApiOps(oldDoc);
const newOps = openApiOps(newDoc);
if (oldOps.size || newOps.size) {
  for (const [key, oldOp] of oldOps.entries()) {
    const newOp = newOps.get(key);
    if (!newOp) {
      breaking.push({ type: 'removed-operation', severity: 'high', path: key });
      continue;
    }
    for (const code of responseCodes(oldOp)) {
      if (!responseCodes(newOp).has(code)) breaking.push({ type: 'removed-response', severity: 'high', path: `${key} ${code}` });
    }
  }
  for (const key of newOps.keys()) if (!oldOps.has(key)) additive.push({ type: 'added-operation', severity: 'info', path: key });
}
const oldSchemas = oldDoc.components?.schemas || oldDoc.definitions || {};
const newSchemas = newDoc.components?.schemas || newDoc.definitions || {};
for (const [name, oldSchema] of Object.entries(oldSchemas)) {
  const newSchema = newSchemas[name];
  if (!newSchema) {
    breaking.push({ type: 'removed-schema', severity: 'high', path: name });
    continue;
  }
  const oldProps = schemaProps(oldSchema);
  const newProps = schemaProps(newSchema);
  for (const prop of Object.keys(oldProps)) {
    if (!(prop in newProps)) breaking.push({ type: 'removed-property', severity: 'high', path: `${name}.${prop}` });
    else if (oldProps[prop]?.type && newProps[prop]?.type && oldProps[prop].type !== newProps[prop].type) {
      breaking.push({ type: 'property-type-change', severity: 'medium', path: `${name}.${prop}`, before: oldProps[prop].type, after: newProps[prop].type });
    }
  }
  for (const prop of requiredSet(newSchema)) {
    if (!requiredSet(oldSchema).has(prop)) breaking.push({ type: 'new-required-property', severity: 'high', path: `${name}.${prop}` });
  }
  for (const prop of Object.keys(newProps)) {
    if (!(prop in oldProps)) additive.push({ type: 'added-property', severity: 'info', path: `${name}.${prop}` });
  }
}
if (!oldOps.size && !newOps.size && !Object.keys(oldSchemas).length && !Object.keys(newSchemas).length) {
  const oldFlat = flatten(oldDoc);
  const newFlat = flatten(newDoc);
  for (const [key, type] of oldFlat.entries()) {
    if (!newFlat.has(key)) breaking.push({ type: 'removed-field', severity: 'high', path: key });
    else if (newFlat.get(key) !== type) breaking.push({ type: 'type-change', severity: 'medium', path: key, before: type, after: newFlat.get(key) });
  }
  for (const key of newFlat.keys()) if (!oldFlat.has(key)) additive.push({ type: 'added-field', severity: 'info', path: key });
}
for (let i = breaking.length - 1; i >= 0; i -= 1) if (ignored(breaking[i])) breaking.splice(i, 1);
for (let i = additive.length - 1; i >= 0; i -= 1) if (ignored(additive[i])) additive.splice(i, 1);
if (!breaking.length && additive.length) warnings.push({ type: 'additive-only', message: 'Only additive changes detected; still confirm generated clients tolerate new fields.' });
const result = { breaking, additive, warnings, summary: { breaking: breaking.length, additive: additive.length, warnings: warnings.length } };
if (jsonOut) console.log(JSON.stringify(result, null, 2));
else console.log(`# API Contract Diff

## Breaking changes
${breaking.length ? breaking.slice(0, 80).map((item) => `- ${item.type}: ${item.path}${item.before ? ` (${item.before} -> ${item.after})` : ''}`).join('\n') : '- None detected.'}

## Additive changes
${additive.length ? additive.slice(0, 80).map((item) => `- ${item.type}: ${item.path}`).join('\n') : '- None detected.'}

## Warnings
${warnings.length ? warnings.map((item) => `- ${item.type}: ${item.message}`).join('\n') : '- None.'}
`);
if (failOnBreaking && breaking.length) process.exit(2);
