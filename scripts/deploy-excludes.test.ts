import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('deploy exclusions only match paths at the workspace root', () => {
	const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
	const match = workflow.match(/^\s+EXCLUDE:\s*"([^"]+)"/m);

	assert.ok(match, 'deploy workflow must define its rsync exclusions');

	const exclusions = match[1].split(',').map((pattern) => pattern.trim());
	for (const pattern of exclusions) {
		assert.ok(
			pattern.startsWith('/'),
			`rsync exclusion ${pattern} must be root-anchored so nested build output is deployed`,
		);
	}
});
