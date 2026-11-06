import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadQuestions } from "./load-questions.ts";

const pathOf = (relative: string) =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url));

const questions = await loadQuestions(pathOf("data/question-sources"));
const outputDirectory = pathOf("public/data/questions");

for (const question of questions) {
  const fileName = `${String(question.number).padStart(4, "0")}.json`;
  await writeFile(
    `${outputDirectory}/${fileName}`,
    `${JSON.stringify(question, null, 2)}\n`,
  );
}
await writeFile(
  `${outputDirectory}/index.json`,
  `${JSON.stringify({ count: questions.length })}\n`,
);
console.log(`${questions.length} 問を生成しました`);
