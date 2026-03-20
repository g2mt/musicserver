package searchparser

import (
	"strings"
	"unicode"
)

type Result struct {
	Words     []string
	Negated   []string
	Operators []Operator
}

type Operator struct {
	Key   string
	Value string
}

func Parse(query string) Result {
	result := Result{
		Words:     []string{},
		Negated:   []string{},
		Operators: []Operator{},
	}

	i := 0
	for i < len(query) {
		// Skip whitespace
		for i < len(query) && unicode.IsSpace(rune(query[i])) {
			i++
		}

		if i >= len(query) {
			break
		}

		// Try negated first
		if i+1 < len(query) && query[i] == '-' && isWordChar(query[i+1]) {
			start := i + 1
			i++
			for i < len(query) && isWordChar(query[i]) {
				i++
			}
			result.Negated = append(result.Negated, query[start:i])
			continue
		}

		// Try quoted
		if query[i] == '"' {
			start := i + 1
			i++
			var sb strings.Builder
			for i < len(query) {
				if query[i] == '\\' && i+1 < len(query) {
					i++
					sb.WriteByte(query[i])
					i++
				} else if query[i] == '"' {
					i++
					result.Words = append(result.Words, sb.String())
					break
				} else {
					sb.WriteByte(query[i])
					i++
				}
			}
			continue
		}

		// Try operator
		opKey, opValue, consumed := tryParseOperator(query[i:])
		if consumed > 0 {
			result.Operators = append(result.Operators, Operator{Key: opKey, Value: opValue})
			i += consumed
			continue
		}

		// Parse as word
		start := i
		for i < len(query) && isWordChar(query[i]) {
			i++
		}
		if i > start {
			result.Words = append(result.Words, query[start:i])
		}
	}

	return result
}

func isWordChar(c byte) bool {
	return !unicode.IsSpace(rune(c))
}

func tryParseOperator(s string) (key, value string, consumed int) {
	for i := 0; i < len(s); i++ {
		if s[i] == ':' && i > 0 {
			key := s[:i]
			value := s[i+1:]
			// Check if value is a valid word or quoted
			if len(value) > 0 {
				if value[0] == '"' {
					// Try to parse quoted value
					end := len(value)
					found := false
					for j := 1; j < len(value); j++ {
						if value[j] == '"' && (j == 1 || value[j-1] != '\\') {
							end = j + 1
							found = true
							break
						}
					}
					if found {
						return key, value[1:end-1], i + end
					}
				} else if isWordChar(value[0]) {
					// Parse word value
					j := 1
					for j < len(value) && isWordChar(value[j]) {
						j++
					}
					return key, value[:j], i + j
				}
			}
		}
	}
	return "", "", 0
}
