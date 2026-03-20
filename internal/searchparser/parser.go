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
		negated, consumed := parseNegated(query[i:])
		if consumed > 0 {
			result.Negated = append(result.Negated, negated)
			i += consumed
			continue
		}

		// Try quoted
		quoted, consumed := parseQuoted(query[i:])
		if consumed > 0 {
			result.Words = append(result.Words, quoted)
			i += consumed
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
		word, consumed := parseWord(query[i:])
		if consumed > 0 {
			result.Words = append(result.Words, word)
			i += consumed
		}
	}

	return result
}

func parseNegated(s string) (string, int) {
	if len(s) < 2 || s[0] != '-' || !isWordChar(s[1]) {
		return "", 0
	}

	start := 1
	i := 1
	for i < len(s) && isWordChar(s[i]) {
		i++
	}
	return s[start:i], i
}

func parseQuoted(s string) (string, int) {
	if len(s) == 0 || s[0] != '"' {
		return "", 0
	}

	i := 1
	var sb strings.Builder
	for i < len(s) {
		if s[i] == '\\' && i+1 < len(s) {
			i++
			sb.WriteByte(s[i])
			i++
		} else if s[i] == '"' {
			i++
			return sb.String(), i
		} else {
			sb.WriteByte(s[i])
			i++
		}
	}
	return "", 0
}

func parseWord(s string) (string, int) {
	if len(s) == 0 || !isWordChar(s[0]) {
		return "", 0
	}

	start := 0
	i := 0
	for i < len(s) && isWordChar(s[i]) {
		i++
	}
	if i > start {
		return s[start:i], i
	}
	return "", 0
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
						return key, value[1 : end-1], i + end
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
