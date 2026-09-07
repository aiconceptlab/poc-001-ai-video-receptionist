export function previewAnswer(question, facts) {
  const normalize = (text) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const normalized = normalize(question);
  const fact =
    facts.find((f) => normalized === normalize(f.question)) ??
    facts.find((f) =>
      f.keywords.some((k) => (' ' + normalized + ' ').includes(' ' + k + ' ')),
    );
  // Deterministic demo, not semantic retrieval or an LLM.
  return fact
    ? { text: fact.answer, source: fact.id, contact: fact.id === 'contact' }
    : {
        text: "I don't have that information in the sample FAQ. You can leave a project enquiry, or try one of the suggested questions.",
        source: null,
        contact: false,
      };
}
