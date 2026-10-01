type TaggedValues = Record<string, string | undefined>;

/**
 * Wrap a record of values as `<tag>value</tag>` sections joined by blank lines.
 *
 * The result is the canonical "tagged message" used as the user-role content
 * for LLM calls. Tagged envelopes keep the input parseable when a single
 * call later needs to feed the prompt alongside structured feedback
 * (e.g. a `validation_feedback` section on retry). `undefined` values are
 * skipped, allowing callers to optionally include tags.
 */
export function toTaggedMessage(values: TaggedValues): string {
  const sections: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") {
      sections.push(`<${key}>\n${value}\n</${key}>`);
    }
  }
  return sections.join("\n");
}

/**
 * Extract the contents of the first `<tag>...</tag>` section in `text`.
 * Returns the trimmed text unchanged when the section is missing, which
 * makes the function safe to call against model output that may or may
 * not have echoed the tag.
 */
export function extractTaggedSection(text: string, tag: string): string {
  const startTag = `<${tag}>`;
  const endTag = `</${tag}>`;
  const startIndex = text.indexOf(startTag);
  const endIndex = text.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1) {
    return text.trim();
  }

  return text.slice(startIndex + startTag.length, endIndex).trim();
}