/**
 * Policy helpers for treating operator diversity as a security boundary.
 *
 * Important: this module does NOT claim permissionless Sybil resistance.
 * operatorId is meaningful only when backed by an external registry,
 * attestation, stake, or other Sybil-resistant identity mechanism.
 */

export function assessIndependence(observations, {
  minDistinctOperators = 2,
  minDistinctProviders = 2,
  minDistinctSourceGroups = 2,
  trustedOperatorIds = null,
} = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    return { independent: false, reason: 'no-observations', diversity: emptyDiversity() };
  }

  const operators = observations.map((item) => item.evidence?.operatorId).filter(Boolean);
  const providers = observations.map((item) => item.evidence?.providerId).filter(Boolean);
  const sourceGroups = observations.map((item) => item.evidence?.sourceGroup).filter(Boolean);
  const diversity = {
    distinctOperators: new Set(operators).size,
    distinctProviders: new Set(providers).size,
    distinctSourceGroups: new Set(sourceGroups).size,
  };

  if (operators.length !== observations.length) return { independent: false, reason: 'missing-operator-identity', diversity };
  if (providers.length !== observations.length) return { independent: false, reason: 'missing-provider-identity', diversity };
  if (sourceGroups.length !== observations.length) return { independent: false, reason: 'missing-source-group', diversity };
  if (diversity.distinctOperators < minDistinctOperators) return { independent: false, reason: 'insufficient-operator-diversity', diversity };
  if (diversity.distinctProviders < minDistinctProviders) return { independent: false, reason: 'insufficient-provider-diversity', diversity };
  if (diversity.distinctSourceGroups < minDistinctSourceGroups) return { independent: false, reason: 'insufficient-source-diversity', diversity };

  if (trustedOperatorIds) {
    const trusted = new Set(trustedOperatorIds);
    const untrusted = operators.filter((id) => !trusted.has(id));
    if (untrusted.length) return { independent: false, reason: 'untrusted-operator', diversity, untrustedOperators: [...new Set(untrusted)].sort() };
  }

  return { independent: true, reason: 'diversity-policy-satisfied', diversity };
}

export function emptyDiversity() {
  return { distinctOperators: 0, distinctProviders: 0, distinctSourceGroups: 0 };
}
