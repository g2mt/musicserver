# Specification

This document describes a search query language similar to those used by popular search engines.

## Grammar

```
root ::= param*

param ::= [ whitespace+ | begin of query ] [ negated | quoted | operator | word ]
whitespace ::= (any whitespace defined by Unicode's White Space property) 

operator ::= operatorKey ':' operatorValue
operatorKey ::= operatorKeyChar
operatorKeyChar ::= (any wordChar character not ':')
operatorValue ::= [ word | quoted ]

word ::= wordStart wordChar*
wordStart ::= (any character not a whitespace, and not '-')
wordChar ::= (any character not a whitespace)

negated ::= negatedOperator | negatedWord
negatedOperator ::= '-' operator
negatedWord ::= '-' wordChar+

quoted ::= '"' quotedChar* '"'
quotedChar ::=
    quotedEscapeChar
  | (any char not '"', or '\')
quotedEscapeChar ::= '\' (any char)
```

The order of the grammar rules in each definition dictates which rule gets executed first. When parsing the `param` rule, try to parse the text after the whitespace as a `negated` first. If that fails, try doing the `quoted` rule, then the `operator` rule, then the `word` rule.

## Query result

Query result should be a struct with the following fields:

  * `words`: array of strings, contains all `word`, or `quoted` (without the quote characters, and transforming every `quotedEscapeChar` into the unescaped character on the right) parsed from left to right
  * `negated`: array of strings, contains all `negated` parsed, excluding the starting '-' character
  * `operators`: array of (operatorKey, operatorValue) tuples

## Examples

```
 a bc
```

  - **Words**: `a`, `bc`

---

```
  a  -x bc
```

  - **Words**: `a`, `bc`
  - **Negated**: `x`

---

```
xyz -abc def asdf:qwerty
```

  - **Words**: `xyz`, `def`
  - **Negated**: `abc`
  - **Operators**: `asdf`: `qwerty`

---

```
-
```

  - **Words**: `-`

---

```
asdf:
```

  - **Words**: `asdf:`

---

```
-asdf:asdf
```

  - **Negated**: operator `asdf`: `asdf`
