#!/usr/bin/env node
import fs from 'node:fs';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h') || args.filter((a) => !a.startsWith('-')).length < 2) {
  console.log(`api-contract-diff

Usage:
  api-contract-diff <old.json> <new.json> [--json]`);
  process.exit(args.includes('--help') || args.includes('-h') ? 0 : 1);
}
const jsonOut = args.includes('--json');
const [oldFile, newFile] = args.filter((a) => !a.startsWith('-'));
const oldDoc = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
const newDoc = JSON.parse(fs.readFileSync(newFile, 'utf8'));

function flatten(value, prefix = '') {
  const out = new Map();
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  out.set(prefix || '$', type);
  if (value && typeof value === 'object') {
    const entries = Array.isArray(value) ? Object.entries(value.slice(0, 1)) : Object.entries(value);
    for (const [key, child] of entries) {
      const next = Array.isArray(value) ? `${prefix}[]` : `${prefix}.${key}`;
      for (const [p, t] of flatten(child, next.replace(/^\./, '')).entries()) out.set(p, t);
    }
  }
  return out;
}

function openApiOps(doc) {
  const ops = new Map();
  for (const [route, methods] of Object.entries(doc.paths || {})) {
    for (const [method, op] of Object.entries(methods || {})) {
      ops.set(`${method.toUpperCase()} ${route}`, op);
    }
  }
  return ops;
}

const breaking = [];
const additive = [];
const oldOps = openApiOps(oldDoc);
const newOps = openApiOps(newDoc);
if (oldOps.size || newOps.size) {
  for (const key of oldOps.keys()) if (!newOps.has(key)) breaking.push({ type: 'removed-operation', path: key });
  for (const key of newOps.keys()) if (!oldOps.has(key)) additive.push({ type: 'added-operation', path: key });
}
const oldFlat = flatten(oldDoc);
const newFlat = flatten(newDoc);
for (const [key, type] of oldFlat.entries()) {
  if (!newFlat.has(key)) breaking.push({ type: 'removed-field', path: key });
  else if (newFlat.get(key) !== type) breaking.push({ type: 'type-change', path: key, before: type, after: newFlat.get(key) });
}
for (const key of newFlat.keys()) {
  if (!oldFlat.has(key)) additive.push({ type: 'added-field', path: key });
}
const result = { breaking, additive, summary: { breaking: breaking.length, additive: additive.length } };
if (jsonOut) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
console.log(`# API Contract Diff

## Breaking changes
${breaking.length ? breaking.slice(0, 50).map((item) => `- ${item.type}: ${item.path}${item.before ? ` (${item.before} -> ${item.after})` : ''}`).join('\n') : '- None detected.'}

## Additive changes
${additive.length ? additive.slice(0, 50).map((item) => `- ${item.type}: ${item.path}`).join('\n') : '- None detected.'}
`);
