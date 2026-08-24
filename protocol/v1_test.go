package v1

import (
	"encoding/json"
	"testing"
)

func TestCanonicalJSONDeterministic(t *testing.T) {
	value := map[string]any{
		"b": "two",
		"a": 1,
		"nested": map[string]any{
			"z": []any{"nkn", 2},
			"x": true,
		},
	}
	got, err := CanonicalJSON(value)
	if err != nil { t.Fatal(err) }
	want := `{"a":1,"b":"two","nested":{"x":true,"z":["nkn",2]}}`
	if string(got) != want { t.Fatalf("canonical JSON mismatch: got %s want %s", got, want) }

	d, err := Digest(value)
	if err != nil { t.Fatal(err) }
	wantDigest := "1c9808d0e2c2907e5ebb8df6cad5266a582c1ba0f8bd0fe12cc11027dcc942c8"
	if d != wantDigest { t.Fatalf("digest mismatch: got %s want %s", d, wantDigest) }
}

func TestCanonicalRejectsFloatingPoint(t *testing.T) {
	_, err := CanonicalJSON(map[string]any{"risk": 1.25})
	if err == nil { t.Fatal("expected non-integer canonical number to be rejected") }
}

func TestEnvelopeValidation(t *testing.T) {
	e, err := NewEnvelope("request", "r1", "sender", "recipient", 100, 200, map[string]any{"task": "ping"})
	if err != nil { t.Fatal(err) }
	if e.V != Version { t.Fatalf("unexpected version %d", e.V) }

	data, err := json.Marshal(e)
	if err != nil { t.Fatal(err) }
	if len(data) == 0 { t.Fatal("empty envelope") }
}
