package v1

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type vectorFile struct {
	Input     map[string]any `json:"input"`
	Canonical string         `json:"canonical"`
	SHA256    string         `json:"sha256"`
}

func TestSharedCanonicalVector(t *testing.T) {
	path := filepath.Join("..", "vectors", "protocol-v1-canonical.json")
	data, err := os.ReadFile(path)
	if err != nil { t.Fatal(err) }
	var vector vectorFile
	if err := json.Unmarshal(data, &vector); err != nil { t.Fatal(err) }

	canonical, err := CanonicalJSON(vector.Input)
	if err != nil { t.Fatal(err) }
	if string(canonical) != vector.Canonical { t.Fatalf("canonical mismatch: got %s want %s", canonical, vector.Canonical) }

	digest, err := Digest(vector.Input)
	if err != nil { t.Fatal(err) }
	if digest != vector.SHA256 { t.Fatalf("digest mismatch: got %s want %s", digest, vector.SHA256) }
}
