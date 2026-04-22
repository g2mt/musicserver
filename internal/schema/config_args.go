package schema

import (
	"encoding/json"

	"github.com/goccy/go-yaml"
	"github.com/google/shlex"
)

// CmdArgsConfig is a custom type for command line arguments that can be
// deserialized from either a string (using shell-style quoting) or a string list.
// It always serializes to a string list.
type CmdArgsConfig []string

// UnmarshalYAML implements yaml.Unmarshaler for CmdArgsConfig.
func (c *CmdArgsConfig) UnmarshalYAML(data []byte) error {
	var str string
	if err := yaml.Unmarshal(data, &str); err == nil {
		args, err := shlex.Split(str)
		if err != nil {
			return err
		}
		*c = CmdArgsConfig(args)
		return nil
	}

	var slice []string
	if err := yaml.Unmarshal(data, &slice); err != nil {
		return err
	}
	*c = CmdArgsConfig(slice)
	return nil
}

// MarshalYAML implements yaml.Marshaler for CmdArgsConfig.
func (c CmdArgsConfig) MarshalYAML() ([]byte, error) {
	return yaml.Marshal([]string(c))
}

// UnmarshalJSON implements json.Unmarshaler for CmdArgsConfig.
func (c *CmdArgsConfig) UnmarshalJSON(data []byte) error {
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		args, err := shlex.Split(str)
		if err != nil {
			return err
		}
		*c = CmdArgsConfig(args)
		return nil
	}

	var slice []string
	if err := json.Unmarshal(data, &slice); err != nil {
		return err
	}
	*c = CmdArgsConfig(slice)
	return nil
}

// MarshalJSON implements json.Marshaler for CmdArgsConfig.
func (c CmdArgsConfig) MarshalJSON() ([]byte, error) {
	return json.Marshal([]string(c))
}
