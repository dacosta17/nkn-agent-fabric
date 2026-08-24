package v1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"unicode/utf8"
)

const Version = 1
const maxSafeInteger = int64(9007199254740991)

func CanonicalJSON(v any) ([]byte, error) {
	var buf bytes.Buffer
	if err := appendCanonical(&buf, v); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
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
	if e.V != Version {
		return fmt.Errorf("unsupported protocol version: %d", e.V)
	}
	if e.Kind == "" || e.RequestID == "" || e.Sender == "" || e.Recipient == "" {
		return errors.New("missing required envelope metadata")
	}
	if e.CreatedAt <= 0 || e.ExpiresAt <= e.CreatedAt {
		return errors.New("invalid envelope timestamps")
	}
	return nil
}

func appendCanonical(buf *bytes.Buffer, v any) error {
	switch x := v.(type) {
	case nil:
		buf.WriteString("null")
	case bool:
		if x { buf.WriteString("true") } else { buf.WriteString("false") }
	case string:
		return appendJSONString(buf, x)
	case int:
		return appendInteger(buf, int64(x))
	case int8:
		return appendInteger(buf, int64(x))
	case int16:
		return appendInteger(buf, int64(x))
	case int32:
		return appendInteger(buf, int64(x))
	case int64:
		return appendInteger(buf, x)
	case uint:
		if uint64(x) > uint64(maxSafeInteger) { return errors.New("canonical integer exceeds JavaScript safe integer range") }
		buf.WriteString(strconv.FormatUint(uint64(x), 10))
	case uint8:
		buf.WriteString(strconv.FormatUint(uint64(x), 10))
	case uint16:
		buf.WriteString(strconv.FormatUint(uint64(x), 10))
	case uint32:
		if uint64(x) > uint64(maxSafeInteger) { return errors.New("canonical integer exceeds JavaScript safe integer range") }
		buf.WriteString(strconv.FormatUint(uint64(x), 10))
	case uint64:
		if x > uint64(maxSafeInteger) { return errors.New("canonical integer exceeds JavaScript safe integer range") }
		buf.WriteString(strconv.FormatUint(x, 10))
	case json.Number:
		i, err := strconv.ParseInt(string(x), 10, 64)
		if err != nil { return errors.New("canonical protocol numbers must be signed integers") }
		return appendInteger(buf, i)
	case float32:
		return appendFloatInteger(buf, float64(x))
	case float64:
		return appendFloatInteger(buf, x)
	case []any:
		buf.WriteByte('[')
		for i, item := range x {
			if i > 0 { buf.WriteByte(',') }
			if err := appendCanonical(buf, item); err != nil { return err }
		}
		buf.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(x))
		for key := range x { keys = append(keys, key) }
		sort.Slice(keys, func(i, j int) bool { return bytes.Compare([]byte(keys[i]), []byte(keys[j])) < 0 })
		buf.WriteByte('{')
		for i, key := range keys {
			if i > 0 { buf.WriteByte(',') }
			if err := appendJSONString(buf, key); err != nil { return err }
			buf.WriteByte(':')
			if err := appendCanonical(buf, x[key]); err != nil { return err }
		}
		buf.WriteByte('}')
	default:
		return fmt.Errorf("unsupported canonical type %T", v)
	}
	return nil
}

func appendInteger(buf *bytes.Buffer, value int64) error {
	if value < -maxSafeInteger || value > maxSafeInteger {
		return errors.New("canonical integer exceeds JavaScript safe integer range")
	}
	buf.WriteString(strconv.FormatInt(value, 10))
	return nil
}

func appendFloatInteger(buf *bytes.Buffer, value float64) error {
	if math.IsNaN(value) || math.IsInf(value, 0) || math.Trunc(value) != value {
		return errors.New("canonical protocol numbers must be finite integers")
	}
	return appendInteger(buf, int64(value))
}

func appendJSONString(buf *bytes.Buffer, value string) error {
	if !utf8.ValidString(value) {
		return errors.New("canonical strings must be valid UTF-8")
	}
	buf.WriteByte('"')
	for _, r := range value {
		switch r {
		case '"': buf.WriteString(`\"`)
		case '\\': buf.WriteString(`\\`)
		case '\b': buf.WriteString(`\b`)
		case '\f': buf.WriteString(`\f`)
		case '\n': buf.WriteString(`\n`)
		case '\r': buf.WriteString(`\r`)
		case '\t': buf.WriteString(`\t`)
		default:
			if r < 0x20 { fmt.Fprintf(buf, `\u%04x`, r) } else { buf.WriteRune(r) }
		}
	}
	buf.WriteByte('"')
	return nil
}
