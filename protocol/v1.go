package v1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
)

const Version = 1

// CanonicalJSON serializes protocol values deterministically.
// Protocol v1 permits JSON null, booleans, strings, arrays, objects, and
// integer numbers only. Decimal quantities MUST be represented as strings.
// This avoids language-specific floating-point serialization differences.
func CanonicalJSON(v any) ([]byte, error) {
	if err := validateCanonical(v); err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "")
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buf.Bytes(), []byte{'\n'}), nil
}

func Digest(v any) (string, error) {
	canonical, err := CanonicalJSON(v)
	if err != nil {
		return "", err
	}
	h := sha256.Sum256(canonical)
	return hex.EncodeToString(h[:]), nil
}

type Envelope struct {
	V         int            `json:"v"`
	Kind      string         `json:"kind"`
	RequestID string         `json:"requestId"`
	Sender    string         `json:"sender"`
	Recipient string         `json:"recipient"`
	CreatedAt int64          `json:"createdAt"`
	ExpiresAt int64          `json:"expiresAt"`
	Payload   map[string]any `json:"payload"`
}

func NewEnvelope(kind, requestID, sender, recipient string, createdAt, expiresAt int64, payload map[string]any) (Envelope, error) {
	e := Envelope{V: Version, Kind: kind, RequestID: requestID, Sender: sender, Recipient: recipient, CreatedAt: createdAt, ExpiresAt: expiresAt, Payload: payload}
	if err := ValidateEnvelope(e); err != nil {
		return Envelope{}, err
	}
	return e, nil
}

func ValidateEnvelope(e Envelope) error {
	if e.V != Version { return fmt.Errorf("unsupported protocol version: %d", e.V) }
	if e.Kind == "" || e.RequestID == "" || e.Sender == "" || e.Recipient == "" { return errors.New("missing required envelope metadata") }
	if e.CreatedAt <= 0 || e.ExpiresAt <= e.CreatedAt { return errors.New("invalid envelope timestamps") }
	return nil
}

func validateCanonical(v any) error {
	switch x := v.(type) {
	case nil, bool, string:
		return nil
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, json.Number:
		return nil
	case float32:
		if math.IsNaN(float64(x)) || math.IsInf(float64(x), 0) || math.Trunc(float64(x)) != float64(x) { return errors.New("canonical protocol numbers must be finite integers") }
		return nil
	case float64:
		if math.IsNaN(x) || math.IsInf(x, 0) || math.Trunc(x) != x { return errors.New("canonical protocol numbers must be finite integers") }
		return nil
	case []any:
		for _, item := range x { if err := validateCanonical(item); err != nil { return err } }
		return nil
	case map[string]any:
		for key, value := range x { if err := validateCanonical(value); err != nil { return fmt.Errorf("key %q: %w", key, err) } }
		return nil
	default:
		return fmt.Errorf("unsupported canonical type %T", v)
	}
}
