# Test-case CSV line breaks

Apply when writing test-case CSVs to `output/`, before generating vault mirrors
or copying results to `queue/`. The saved CSV itself must contain the formatting.

- In `steps`, put each numbered action on its own line inside the same cell.
- In `expected result`, put each numbered assertion on its own line inside the
  same cell. Preserve paragraphs in unnumbered prose; do not invent assertions
  or split sentences mechanically.
- Store actual newline characters, not literal `\n`, HTML `<br>`, or numbered
  items separated only by spaces.
- Use a CSV writer. Quote fields containing newlines, commas, or double quotes,
  and escape embedded double quotes as `""`. A multiline cell remains part of
  one logical test-case row.
- API cases: keep the full executable curl in `steps`; a single command may
  remain one line. In `expected result`, put the explanation, `---` separator,
  and full response on separate lines. Pretty-print JSON without changing any
  values; preserve non-JSON response text.

Example literal CSV (two columns, one test case):

```csv
steps,expected result
"1. Open the form.
2. Click ""Save"".","1. The form is saved.
2. A confirmation appears."
```

Before completion, read the saved file back with a CSV parser (never split on
physical lines). Check the logical row count and each row's column count against
the generated data. Confirm multiline steps/expectations round-trip exactly,
including quotes, commas, and real newlines, and check that numbered items are
on separate lines. Correct formatting in `output/` before copying identical
bytes to the queue result. Do not rely on UI/export formatting to repair it.
