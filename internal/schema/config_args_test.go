package schema

import (
	"encoding/json"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/google/go-cmp/cmp"
)

func TestCmdArgsConfig_UnmarshalYAML_String(t *testing.T) {
	data := []byte(`one "two three" four`)
	var args CmdArgsConfig
	err := yaml.Unmarshal(data, &args)
	if err != nil {
		t.Fatalf("UnmarshalYAML() error = %v", err)
	}

	want := CmdArgsConfig{"one", "two three", "four"}
	if diff := cmp.Diff(want, args); diff != "" {
		t.Errorf("UnmarshalYAML() mismatch (-want +got):\n%s", diff)
	}
}

func TestCmdArgsConfig_UnmarshalYAML_Slice(t *testing.T) {
	data := []byte(`- one
- two
- three`)
	var args CmdArgsConfig
	err := yaml.Unmarshal(data, &args)
	if err != nil {
		t.Fatalf("UnmarshalYAML() error = %v", err)
	}

	want := CmdArgsConfig{"one", "two", "three"}
	if diff := cmp.Diff(want, args); diff != "" {
		t.Errorf("UnmarshalYAML() mismatch (-want +got):\n%s", diff)
	}
}

func TestCmdArgsConfig_MarshalYAML(t *testing.T) {
	args := CmdArgsConfig{"one", "two", "three"}
	data, err := yaml.Marshal(args)
	if err != nil {
		t.Fatalf("MarshalYAML() error = %v", err)
	}

	var got []string
	err = yaml.Unmarshal(data, &got)
	if err != nil {
		t.Fatalf("Unmarshal error = %v", err)
	}

	want := []string{"one", "two", "three"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("MarshalYAML() mismatch (-want +got):\n%s", diff)
	}
}

func TestCmdArgsConfig_UnmarshalJSON_String(t *testing.T) {
	data := []byte(`"one \"two three\" four"`)
	var args CmdArgsConfig
	err := json.Unmarshal(data, &args)
	if err != nil {
		t.Fatalf("UnmarshalJSON() error = %v", err)
	}

	want := CmdArgsConfig{"one", "two three", "four"}
	if diff := cmp.Diff(want, args); diff != "" {
		t.Errorf("UnmarshalJSON() mismatch (-want +got):\n%s", diff)
	}
}

func TestCmdArgsConfig_UnmarshalJSON_Slice(t *testing.T) {
	data := []byte(`["one", "two", "three"]`)
	var args CmdArgsConfig
	err := json.Unmarshal(data, &args)
	if err != nil {
		t.Fatalf("UnmarshalJSON() error = %v", err)
	}

	want := CmdArgsConfig{"one", "two", "three"}
	if diff := cmp.Diff(want, args); diff != "" {
		t.Errorf("UnmarshalJSON() mismatch (-want +got):\n%s", diff)
	}
}

func TestCmdArgsConfig_MarshalJSON(t *testing.T) {
	args := CmdArgsConfig{"one", "two", "three"}
	data, err := json.Marshal(args)
	if err != nil {
		t.Fatalf("MarshalJSON() error = %v", err)
	}

	var got []string
	err = json.Unmarshal(data, &got)
	if err != nil {
		t.Fatalf("Unmarshal error = %v", err)
	}

	want := []string{"one", "two", "three"}
	if diff := cmp.Diff(want, got); diff != "" {
		t.Errorf("MarshalJSON() mismatch (-want +got):\n%s", diff)
	}
}
