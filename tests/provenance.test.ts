import { matchShare, normalizeText } from "../supabase/functions/_shared/provenance";

test("normalizes diacritics, line-break hyphenation, whitespace and quotes", () => {
  expect(normalizeText('„Poveș-\ntile”  sunt\nfrumoase')).toBe('"povestile" sunt frumoase');
});

test("accepts one edited word in a longer passage but rejects unrelated text", () => {
  const page = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone thirtytwo thirtythree thirtyfour thirtyfive thirtysix thirtyseven thirtyeight thirtynine forty";
  const edited = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen changed twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone thirtytwo thirtythree thirtyfour thirtyfive thirtysix thirtyseven thirtyeight thirtynine forty";
  expect(matchShare(edited, page)).toBeGreaterThanOrEqual(0.9);
  expect(matchShare("the moon rises above a quiet distant valley", page)).toBeLessThan(0.9);
});

test("normalizes excerpt markup and paragraph whitespace before matching", () => {
 expect(normalizeText("  one *two*\n\n  **three** four")).toBe("one two three four");
 expect(matchShare("one *two*\n  **three** four", "one two three four")).toBe(1);
});

test("normalizes HTML boundaries and entities before matching", () => {
  expect(normalizeText('<p>One &amp; <strong>two</strong></p><p>three<br>four &lt;five&gt; &quot;six&quot; &#39;seven&#39;&nbsp;eight</p>'))
    .toBe('one & two three four <five> "six" \'seven\' eight');
  expect(matchShare('<p>one <em>two</em></p><p>three<br>four</p>', 'one two three four')).toBe(1);
});
