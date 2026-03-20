# Specification

This document describes a search query language similar to those used by popular search engines.

## Grammar

```
root ::= param*

param ::= whitespace+ [ operator | word | negated | quoted ]
whitespace ::= (any whitespace defined by Unicode's White Space property)

operator ::= operatorKey ':' operatorValue
operatorKey ::= word
operatorValue ::= [ word | quoted ]

word ::= wordStart wordChar*
wordStart ::= (any character not a whitespace)
wordChar ::= (any character not a wordStart, or the '-' character)

negated ::= '-' wordChar+

quoted ::= '"' quotedChar* '"'
quotedChar ::=
    quotedEscapeChar
  | (any char not '"', or '\')
quotedEscapeChar ::= '\' (any char)
```

## Query result

Query result should be a struct with the following fields:

  * `words`: array of strings, contains all `word`, or `quoted` (without the quote characters, and transforming every `quotedEscapeChar` into the unescaped character on the right) parsed from left to right
  * `negated`: array of strings, contains all `negated` parsed, excluding the starting '-' character
  * `operators`: array of (operatorKey, operatorValue) tuples


