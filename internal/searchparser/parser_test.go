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
				Words:           []string{"a", "bc"},
				Negated:         []string{},
				Operators:       []Operator{},
				NegatedOperators: []Operator{},
			},
		},
		{
			name:  "with negated",
			query: "a  -x bc",
			expected: Result{
				Words:           []string{"a", "bc"},
				Negated:         []string{"x"},
				Operators:       []Operator{},
				NegatedOperators: []Operator{},
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
				NegatedOperators: []Operator{},
			},
		},
		{
			name:  "just dash",
			query: "-",
			expected: Result{
				Words:           []string{"-"},
				Negated:         []string{},
				Operators:       []Operator{},
				NegatedOperators: []Operator{},
			},
		},
		{
			name:  "operator without value",
			query: "asdf:",
			expected: Result{
				Words:           []string{"asdf:"},
				Negated:         []string{},
				Operators:       []Operator{},
				NegatedOperators: []Operator{},
			},
		},
		{
			name:  "negated operator",
			query: "-asdf:asdf",
			expected: Result{
				Words:           []string{},
				Negated:         []string{},
				Operators:       []Operator{},
				NegatedOperators: []Operator{
					{Key: "asdf", Value: "asdf"},
				},
			},
		},
		{
			name:  "quoted string",
			query: `"hello world"`,
			expected: Result{
				Words:           []string{"hello world"},
				Negated:         []string{},
				Operators:       []Operator{},
				NegatedOperators: []Operator{},
			},
		},
		{
			name:  "escaped quote in quoted string",
			query: `"hello \"world"`,
			expected: Result{
				Words:           []string{"hello \"world"},
				Negated:         []string{},
				Operators:       []Operator{},
				NegatedOperators: []Operator{},
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
				NegatedOperators: []Operator{},
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
				NegatedOperators: []Operator{},
			},
		},
		{
			name:  "negated quoted string",
			query: `-"hello world" abc`,
			expected: Result{
				Words:           []string{"abc"},
				Negated:         []string{"hello world"},
				Operators:       []Operator{},
				NegatedOperators: []Operator{},
			},
		},
		{
			name:  "mixed query with negated operator",
			query: `word -negated key:"value" -key2:"val2" "quoted word"`,
			expected: Result{
				Words:   []string{"word", "quoted word"},
				Negated: []string{"negated"},
				Operators: []Operator{
					{Key: "key", Value: "value"},
				},
				NegatedOperators: []Operator{
					{Key: "key2", Value: "val2"},
				},
			},
		},
		{
			name:  "negated operator with word value",
			query: `-foo:bar`,
			expected: Result{
				Words:           []string{},
				Negated:         []string{},
				Operators:       []Operator{},
				NegatedOperators: []Operator{
					{Key: "foo", Value: "bar"},
				},
			},
		},
		{
			name:  "negated operator without value falls back to negated word",
			query: `-foo:`,
			expected: Result{
				Words:           []string{},
				Negated:         []string{"foo:"},
				Operators:       []Operator{},
				NegatedOperators: []Operator{},
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
