package searchparser

import (
	"reflect"
	"testing"
)

func TestParse(t *testing.T) {
	tests := []struct {
		name     string
		query    string
		expected Result
	}{
		{
			name:  "simple words",
			query: "a bc",
			expected: Result{
				Words:     []string{"a", "bc"},
				Negated:   []string{},
				Operators: []Operator{},
			},
		},
		{
			name:  "with negated",
			query: "a  -x bc",
			expected: Result{
				Words:     []string{"a", "bc"},
				Negated:   []string{"x"},
				Operators: []Operator{},
			},
		},
		{
			name:  "with operators",
			query: "xyz -abc def asdf:qwerty",
			expected: Result{
				Words:   []string{"xyz", "def"},
				Negated: []string{"abc"},
				Operators: []Operator{
					{Key: "asdf", Value: "qwerty"},
				},
			},
		},
		{
			name:  "just dash",
			query: "-",
			expected: Result{
				Words:     []string{"-"},
				Negated:   []string{},
				Operators: []Operator{},
			},
		},
		{
			name:  "operator without value",
			query: "asdf:",
			expected: Result{
				Words:     []string{"asdf:"},
				Negated:   []string{},
				Operators: []Operator{},
			},
		},
		{
			name:  "negated operator",
			query: "-asdf:asdf",
			expected: Result{
				Words:     []string{},
				Negated:   []string{"asdf:asdf"},
				Operators: []Operator{},
			},
		},
		{
			name:  "quoted string",
			query: `"hello world"`,
			expected: Result{
				Words:     []string{"hello world"},
				Negated:   []string{},
				Operators: []Operator{},
			},
		},
		{
			name:  "escaped quote in quoted string",
			query: `"hello \"world"`,
			expected: Result{
				Words:     []string{"hello \"world"},
				Negated:   []string{},
				Operators: []Operator{},
			},
		},
		{
			name:  "operator with quoted value",
			query: `key:"hello world"`,
			expected: Result{
				Words:   []string{},
				Negated: []string{},
				Operators: []Operator{
					{Key: "key", Value: "hello world"},
				},
			},
		},
		{
			name:  "mixed query",
			query: `word -negated key:"value" "quoted word"`,
			expected: Result{
				Words:   []string{"word", "quoted word"},
				Negated: []string{"negated"},
				Operators: []Operator{
					{Key: "key", Value: "value"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Parse(tt.query)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("Parse(%q) = %+v, want %+v", tt.query, result, tt.expected)
			}
		})
	}
}
