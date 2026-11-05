import type { QuestionRepository } from "@/application/ports";
import type { Question } from "@/domain/game/question";
import {
  validateQuestion,
  validateQuestionManifest,
} from "@/domain/game/validate-question";

export class InvalidQuestionDataError extends Error {
  constructor(url: string, issues: readonly string[]) {
    super(`問題データが不正です: ${url}: ${issues.join(", ")}`);
    this.name = "InvalidQuestionDataError";
  }
}

export class QuestionDataFetchError extends Error {
  constructor(url: string, status: number) {
    super(`問題データを取得できません: ${url}: HTTP ${status}`);
    this.name = "QuestionDataFetchError";
  }
}

async function parseJson(response: Response, url: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new InvalidQuestionDataError(url, ["JSON として読めません"]);
  }
}

/** public/ に置いた静的ファイルから問題を読み込むリポジトリを作る。 */
export function createStaticQuestionRepository({
  baseUrl,
  fetch: fetchFile,
}: {
  /** basePath を含み、末尾に / を付けない。 */
  readonly baseUrl: string;
  readonly fetch: (url: string) => Promise<Response>;
}): QuestionRepository {
  let cachedCount: number | null = null;

  async function count(): Promise<number> {
    if (cachedCount !== null) {
      return cachedCount;
    }
    const url = `${baseUrl}/index.json`;
    const response = await fetchFile(url);
    if (!response.ok) {
      throw new QuestionDataFetchError(url, response.status);
    }
    const manifest = await parseJson(response, url);
    const issues = validateQuestionManifest(manifest);
    if (issues.length > 0) {
      throw new InvalidQuestionDataError(url, issues);
    }
    cachedCount = (manifest as { count: number }).count;
    return cachedCount;
  }

  async function findByNumber(number: number): Promise<Question | null> {
    // 問題番号は端末内のデータから来ることがあるので、ファイル名にする前に確かめる。
    if (!Number.isInteger(number) || number < 1 || number > (await count())) {
      return null;
    }
    const url = `${baseUrl}/${String(number).padStart(4, "0")}.json`;
    const response = await fetchFile(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new QuestionDataFetchError(url, response.status);
    }
    const question = await parseJson(response, url);
    const issues = validateQuestion(question);
    if (issues.length > 0) {
      throw new InvalidQuestionDataError(url, issues);
    }
    const validated = question as Question;
    if (validated.number !== number) {
      throw new InvalidQuestionDataError(url, [
        `number がファイルの番号と異なります: ${validated.number}`,
      ]);
    }
    return validated;
  }

  return { count, findByNumber };
}
