// A small JSON-Schema checker for the project's own schemas (schema/*.schema.json), without a dependency.
// It knows the parts those schemas use: type (also a list), required, properties, additionalProperties: false,
// items, enum, minimum, minItems, maxItems, pattern and local $ref ("#/$defs/…"). Anything else in a schema is
// a description for people and is ignored.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ladeSchema = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', name), 'utf8'));

const typ = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
const passt = (soll, v) => (Array.isArray(soll) ? soll : [soll]).some((t) => t === typ(v) || (t === 'number' && typ(v) === 'integer'));

/** Every place where `wert` breaks `schema`, as "path: message"; empty when it fits. */
export function pruefeSchema(schema, wert, wo = '', wurzel = schema) {
  if (schema.$ref) {
    const ziel = schema.$ref.replace(/^#\//, '').split('/').reduce((s, k) => s?.[k], wurzel);
    if (!ziel) return [`${wo || '/'}: unknown $ref ${schema.$ref}`];
    return pruefeSchema(ziel, wert, wo, wurzel);
  }
  const fehler = [], f = (m) => fehler.push(`${wo || '/'}: ${m}`);
  if (schema.type && !passt(schema.type, wert)) { f(`is ${typ(wert)}, expected ${[].concat(schema.type).join(' or ')}`); return fehler; }
  if (schema.enum && !schema.enum.some((e) => e === wert)) f(`${JSON.stringify(wert)} is not one of ${schema.enum.join(', ')}`);
  if (typeof wert === 'number' && schema.minimum !== undefined && wert < schema.minimum) f(`${wert} is below ${schema.minimum}`);
  if (typeof wert === 'string' && schema.pattern && !new RegExp(schema.pattern).test(wert)) f(`"${wert}" does not match ${schema.pattern}`);
  if (Array.isArray(wert)) {
    if (schema.minItems !== undefined && wert.length < schema.minItems) f(`${wert.length} items, at least ${schema.minItems}`);
    if (schema.maxItems !== undefined && wert.length > schema.maxItems) f(`${wert.length} items, at most ${schema.maxItems}`);
    if (schema.items) wert.forEach((v, i) => fehler.push(...pruefeSchema(schema.items, v, `${wo}/${i}`, wurzel)));
  }
  if (typ(wert) === 'object') {
    for (const k of schema.required ?? []) if (!(k in wert)) f(`"${k}" is missing`);
    for (const [k, v] of Object.entries(wert)) {
      if (schema.properties?.[k]) fehler.push(...pruefeSchema(schema.properties[k], v, `${wo}/${k}`, wurzel));
      else if (schema.additionalProperties === false) f(`"${k}" is not part of the schema`);
    }
  }
  return fehler;
}
