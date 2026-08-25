import assert from 'node:assert/strict';
import test from 'node:test';
import { assessIndependence } from '../src/lib/independence-policy.js';

function observation(operatorId, providerId, sourceGroup = providerId) {
  return { evidence: { operatorId, providerId, sourceGroup } };
}

test('independence policy accepts distinct operators and providers', () => {
  const result = assessIndependence([
    observation('operator-a', 'provider-a', 'source-a'),
    observation('operator-b', 'provider-b', 'source-b'),
    observation('operator-c', 'provider-c', 'source-c'),
  ]);
  assert.equal(result.independent, true);
  assert.deepEqual(result.diversity, { distinctOperators: 3, distinctProviders: 3, distinctSourceGroups: 3 });
});

test('same operator fails even when agents and providers differ', () => {
  const result = assessIndependence([
    observation('operator-a', 'provider-a', 'source-a'),
    observation('operator-a', 'provider-b', 'source-b'),
  ]);
  assert.equal(result.independent, false);
  assert.equal(result.reason, 'insufficient-operator-diversity');
});

test('trusted operator policy rejects an unregistered operator', () => {
  const result = assessIndependence([
    observation('operator-a', 'provider-a'),
    observation('operator-b', 'provider-b'),
  ], { trustedOperatorIds: ['operator-a'] });
  assert.equal(result.independent, false);
  assert.equal(result.reason, 'untrusted-operator');
  assert.deepEqual(result.untrustedOperators, ['operator-b']);
});
