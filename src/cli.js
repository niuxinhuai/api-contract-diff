#!/usr/bin/env node
import fs from 'node:fs';

const VERSION = '0.1.0';
const args = process.argv.slice(2);
function has(flag) { return args.includes(flag); }
function usage() {
  console.log(`api-contract-diff v${VERSION}

Usage:
  api-contract-diff <old.json> <new.json> [--json] [--fail-on-breaking]

Compares OpenAPI/Swagger-style JSON or generic JSON shapes.`);
}
if (has('--help') || has('-h')) { usage(); process.exit(0); }
if (has('--version')) { console.log(VERSION); process.exit(0); }
if (args.filter((a) => !a.startsWith('-')).length < 2) { usage(); process.exit(1); }
const jsonOut = has('--json');
const failOnBreaking = has('--fail-on-breaking');
const [oldFile, newFile] = args.filter((a) => !a.startsWith('-'));
let oldDoc;
let newDoc;
try {
  oldDoc = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
  newDoc = JSON.parse(fs.readFileSync(newFile, 'utf8'));
} catch (error) {
  console.error(`Unable to read JSON contract: ${error.message}`);
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
      breaking.push({ type: 'removed-operation', path: key });
      continue;
    }
    for (const code of responseCodes(oldOp)) {
      if (!responseCodes(newOp).has(code)) breaking.push({ type: 'removed-response', path: `${key} ${code}` });
    }
  }
  for (const key of newOps.keys()) if (!oldOps.has(key)) additive.push({ type: 'added-operation', path: key });
}
const oldSchemas = oldDoc.components?.schemas || oldDoc.definitions || {};
const newSchemas = newDoc.components?.schemas || newDoc.definitions || {};
for (const [name, oldSchema] of Object.entries(oldSchemas)) {
  const newSchema = newSchemas[name];
  if (!newSchema) {
    breaking.push({ type: 'removed-schema', path: name });
    continue;
  }
  const oldProps = schemaProps(oldSchema);
  const newProps = schemaProps(newSchema);
  for (const prop of Object.keys(oldProps)) {
    if (!(prop in newProps)) breaking.push({ type: 'removed-property', path: `${name}.${prop}` });
    else if (oldProps[prop]?.type && newProps[prop]?.type && oldProps[prop].type !== newProps[prop].type) {
      breaking.push({ type: 'property-type-change', path: `${name}.${prop}`, before: oldProps[prop].type, after: newProps[prop].type });
    }
  }
  for (const prop of requiredSet(newSchema)) {
    if (!requiredSet(oldSchema).has(prop)) breaking.push({ type: 'new-required-property', path: `${name}.${prop}` });
  }
  for (const prop of Object.keys(newProps)) {
    if (!(prop in oldProps)) additive.push({ type: 'added-property', path: `${name}.${prop}` });
  }
}
if (!oldOps.size && !newOps.size && !Object.keys(oldSchemas).length && !Object.keys(newSchemas).length) {
  const oldFlat = flatten(oldDoc);
  const newFlat = flatten(newDoc);
  for (const [key, type] of oldFlat.entries()) {
    if (!newFlat.has(key)) breaking.push({ type: 'removed-field', path: key });
    else if (newFlat.get(key) !== type) breaking.push({ type: 'type-change', path: key, before: type, after: newFlat.get(key) });
  }
  for (const key of newFlat.keys()) if (!oldFlat.has(key)) additive.push({ type: 'added-field', path: key });
}
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
