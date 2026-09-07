import { readFile, writeFile } from 'node:fs/promises';
const facts = JSON.parse(
  await readFile(new URL('../knowledge/faq.json', import.meta.url), 'utf8'),
);
const content =
  'AI Concept Lab — POC #001\nSample business facts; fictional demonstration.\n\n' +
  facts
    .map((f) => '[' + f.id + '] ' + f.question + '\n' + f.answer)
    .join('\n\n') +
  '\n';
await writeFile(new URL('../knowledge/faq.txt', import.meta.url), content);
console.log(
  'Updated knowledge/faq.txt. Upload this new copy to your D-ID agent.',
);
