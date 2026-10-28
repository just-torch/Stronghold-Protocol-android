#!/usr/bin/env node
// Write schemas/records.schema.json from the author schema (DESIGN §32.5, PLUGINS §10).
// The checked-in file is the *author* schema: server/plugins/traitSchema.js composes the shared runtime
// RECORDS_SCHEMA with the operator-trait and FX extensions (0.3.1), so it also accepts `trait.dsl` and the trait
// override records. The runtime keeps validating with the smaller shared RECORDS_SCHEMA.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRAIT_RECORDS_SCHEMA } from '../server/plugins/traitSchema.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? path.join(root, 'schemas/records.schema.json'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(TRAIT_RECORDS_SCHEMA, null, 2)}\n`);
