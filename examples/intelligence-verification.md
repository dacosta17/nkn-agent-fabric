# Intelligence verification example

This example describes the intended public workflow without requiring any specific LLM vendor.

## Task

```json
{
  "type": "verifiable-intelligence.v1",
  "question": "Does the target system satisfy the stated availability claim?"
}
```

## Agent outputs

Each agent returns a signed attestation containing:

- task digest;
- result digest;
- source/provenance references;
- capture timestamp;
- agent identity.

Example observation shape:

```json
{
  "answer": "yes",
  "sources": ["source-a", "source-b"],
  "operatorId": "operator-a",
  "providerId": "provider-a"
}
```

## Verification

The verifier should independently check signatures, freshness, source diversity, operator/provider uniqueness, and the domain quorum policy before accepting the answer.

The result should be reproducible from the signed observations without asking an LLM to make the final security decision.
