#!/usr/bin/env node
import assert from 'node:assert/strict';
import { WORLDS, BLUEPRINT, validateWorld, worldNames } from './demo-worlds.mjs';
import { buildWorldSql } from './seed-demo.mjs';

for (const name of worldNames()) {
	const world = WORLDS[name];
	validateWorld(world);
	const sql = buildWorldSql(world, 1);
	assert.doesNotMatch(sql, /undefined/);
	assert.equal((sql.match(/INSERT INTO companies/g) ?? []).length, 3);
	assert.equal((sql.match(/INSERT INTO contacts/g) ?? []).length, 3);
	assert.equal((sql.match(/INSERT INTO contracts/g) ?? []).length, 3);
	assert.equal((sql.match(/INSERT INTO users/g) ?? []).length, 3);
	assert.equal((sql.match(/INSERT INTO queues/g) ?? []).length, 3);
	assert.equal((sql.match(/INSERT INTO tickets/g) ?? []).length, BLUEPRINT.rowCount);
	assert.equal((sql.match(/INSERT INTO ticket_counters/g) ?? []).length, 1);
	assert.equal((sql.match(/UPDATE tickets SET contract_id/g) ?? []).length, 3);
	assert.equal((sql.match(/'triage'/g) ?? []).length, 3, `${name}: expected 3 triage tickets`);
	assert.equal((sql.match(/'resolved'/g) ?? []).length >= 2, true, `${name}: expected resolved tickets`);
}

console.log(`Validated ${worldNames().length} demo worlds: ${worldNames().join(', ')}`);
