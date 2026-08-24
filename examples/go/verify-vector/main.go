package main

import (
	"encoding/json"
	"fmt"
	"os"

	v1 "github.com/dacosta17/nkn-agent-fabric/protocol"
)

type vector struct {
	Input     map[string]any `json:"input"`
	Canonical string         `json:"canonical"`
	SHA256    string         `json:"sha256"`
}

func main() {
	data, err := os.ReadFile("vectors/protocol-v1-canonical.json")
	if err != nil { panic(err) }
	var v vector
	if err := json.Unmarshal(data, &v); err != nil { panic(err) }

	canonical, err := v1.CanonicalJSON(v.Input)
	if err != nil { panic(err) }
	digest, err := v1.Digest(v.Input)
	if err != nil { panic(err) }

	fmt.Println(string(canonical))
	fmt.Println(digest)
}
