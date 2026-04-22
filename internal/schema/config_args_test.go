package schema

import (
	"encoding/json"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/google/go-cmp/cmp"
)

func TestCmdArgsConfig_Unmarshal(t *testing.T) {
	tests := []struct {
		name   string
		format string
		data   []byte
		want   CmdArgsConfig
	}{
		{
			name:   "YAML String",
			format: "yaml",
			data:   []byte(`one "two three" four`),
			want:   CmdArgsConfig{"one", "two three", "four"},
		},
		{
			name:   "YAML Slice",
			format: "yaml",
			data:   []byte(`["one", "two", "three"]`),
			want:   CmdArgsConfig{"one", "two", "three"},
		},
		{
			name:   "JSON String",
			format: "json",
			data:   []byte(`"one \"two three\" four"`),
			want:   CmdArgsConfig{"one", "two three", "four"},
		},
		{
			name:   "JSON Slice",
			format: "json",
			data:   []byte(`["one", "two", "three"]`),
			want:   CmdArgsConfig{"one", "two", "three"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got CmdArgsConfig
			var err error

			if tt.format == "yaml" {
				err = yaml.Unmarshal(tt.data, &got)
			} else if tt.format == "json" {
				err = json.Unmarshal(tt.data, &got)
			} else {
				t.Fatalf("unknown format: %s", tt.format)
			}

			if err != nil {
				t.Fatalf("Unmarshal() error = %v", err)
			}

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("Unmarshal() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestCmdArgsConfig_Marshal(t *testing.T) {
	tests := []struct {
		name   string
		format string
		input  CmdArgsConfig
	}{
		{
			name:   "YAML",
			format: "yaml",
			input:  CmdArgsConfig{"one", "two", "three"},
		},
		{
			name:   "JSON",
			format: "json",
			input:  CmdArgsConfig{"one", "two", "three"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var data []byte
			var err error

			if tt.format == "yaml" {
				data, err = yaml.Marshal(tt.input)
			} else if tt.format == "json" {
				data, err = json.Marshal(tt.input)
			} else {
				t.Fatalf("unknown format: %s", tt.format)
			}

			if err != nil {
				t.Fatalf("Marshal() error = %v", err)
			}

			var got []string
			if tt.format == "yaml" {
				err = yaml.Unmarshal(data, &got)
			} else {
				err = json.Unmarshal(data, &got)
			}

			if err != nil {
				t.Fatalf("Unmarshal error = %v", err)
			}

			want := []string(tt.input)
			if diff := cmp.Diff(want, got); diff != "" {
				t.Errorf("Marshal() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
