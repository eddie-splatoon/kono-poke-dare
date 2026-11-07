// @ts-check
// 評価シートの HTML に埋め込んで、ブラウザで動かすコード。
// 型を消す工程を増やさないように JS で書く。外部のファイルを import しない。

/** @typedef {number | "NA"} Score */
/**
 * @typedef {{
 *   version: string,
 *   scores: Record<string, Score>,
 *   comment: string,
 * }} ScoreRecord
 */
/**
 * @typedef {{
 *   readonly number: number,
 *   readonly name: string,
 *   readonly aliases: readonly string[],
 *   readonly generation: number,
 *   readonly hints: readonly string[],
 *   readonly version: string,
 *   readonly note?: string,
 * }} Entry
 */
/**
 * @typedef {{
 *   readonly generation?: number,
 *   readonly unscoredOnly?: boolean,
 *   readonly priorityOnly?: boolean,
 *   readonly needsFixOnly?: boolean,
 * }} EntryFilter
 */

const NEEDS_FIX_THRESHOLD = 2;
const NEEDS_COMMENT_THRESHOLD = 3;
const HINT_8_INDEX = 7;
const HINT_9_INDEX = 8;
const PAGE_SIZE = 20;
// 観点や基準を変えたら番号を上げて、別の基準で付けた評点を引き継がない。
const STORAGE_KEY = "kono-poke-dare:hint-review:v3";
const SCORE_CHOICES = ["1", "2", "3", "4", "5", "NA"];

/**
 * 全ヒントのハッシュ(FNV-1a)。表計算ソフトが数値として扱わないように `v` で始める。
 * @param {readonly string[]} hints
 * @returns {string}
 */
export function hintsVersion(hints) {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(hints)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `v${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * @param {ScoreRecord | undefined} record
 * @param {readonly string[]} ids
 */
export function summarizeRecord(record, ids) {
  const scores = record?.scores ?? {};
  const numbers = ids.flatMap((id) => {
    const score = scores[id];
    return typeof score === "number" ? [score] : [];
  });
  return {
    total: numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) : null,
    minScore: numbers.length > 0 ? Math.min(...numbers) : null,
    needsFix: numbers.some((score) => score <= NEEDS_FIX_THRESHOLD),
    needsComment: numbers.some((score) => score <= NEEDS_COMMENT_THRESHOLD),
    complete: ids.every((id) => scores[id] !== undefined),
  };
}

/** @param {string} value */
function isFormulaLike(value) {
  return /^'*(?:[\t\r\n]|\s*[=+\-@＝＋－＠])/.test(value);
}

/**
 * 表計算ソフトで数式として解釈されないように `'` を前置する。
 * @param {string} value
 */
export function guardCell(value) {
  return isFormulaLike(value) ? `'${value}` : value;
}

/** @param {string} value */
function unguardCell(value) {
  return value.startsWith("'") && isFormulaLike(value.slice(1))
    ? value.slice(1)
    : value;
}

/** @param {string | number} value */
function csvField(value) {
  const text = typeof value === "number" ? String(value) : guardCell(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * 評点またはコメントがある種族の行だけを書き出す。
 * @param {readonly Entry[]} entries
 * @param {readonly string[]} ids
 * @param {ReadonlyMap<number, ScoreRecord>} state
 */
export function buildCsv(entries, ids, state) {
  const header = [
    "number",
    "name",
    "generation",
    "priority",
    "hints_version",
    ...ids,
    "total",
    "min_score",
    "needs_fix",
    "comment",
    "hint_8",
    "hint_9",
  ];
  const rows = entries.flatMap((entry) => {
    const record = state.get(entry.number);
    if (
      record === undefined ||
      (Object.keys(record.scores).length === 0 && record.comment === "")
    ) {
      return [];
    }
    const { total, minScore, needsFix } = summarizeRecord(record, ids);
    return [
      [
        entry.number,
        entry.name,
        entry.generation,
        entry.note === undefined ? 0 : 1,
        entry.version,
        ...ids.map((id) => record.scores[id] ?? ""),
        total ?? "",
        minScore ?? "",
        needsFix ? 1 : 0,
        record.comment,
        entry.hints[HINT_8_INDEX] ?? "",
        entry.hints[HINT_9_INDEX] ?? "",
      ],
    ];
  });
  const lines = [header, ...rows].map((row) => row.map(csvField).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/**
 * RFC 4180 の CSV を解析する。空行は無視する。
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const source = text.replace(/^﻿/, "");
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = "";
  let inQuotes = false;
  const endRow = () => {
    row.push(field);
    field = "";
    if (row.length > 1 || row[0] !== "") {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = false;
      }
    } else if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") {
        i += 1;
      }
      endRow();
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    throw new Error("引用符が閉じていません");
  }
  if (field !== "" || row.length > 0) {
    endRow();
  }
  return rows;
}

/**
 * @param {unknown} value
 * @returns {Score | null}
 */
function validScore(value) {
  if (value === "NA") {
    return "NA";
  }
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
    ? value
    : null;
}

/**
 * CSV の行を検証して、採用できる採点だけを返す。
 * @param {string} text
 * @param {readonly Entry[]} entries
 * @param {readonly string[]} ids
 */
export function importCsv(text, entries, ids) {
  const [header, ...rows] = parseCsv(text);
  const required = ["number", "hints_version", ...ids, "comment"];
  const missing = required.filter((name) => !header?.includes(name));
  if (header === undefined || missing.length > 0) {
    throw new Error(`列がありません: ${missing.join(", ") || required[0]}`);
  }
  /** @param {string[]} row @param {string} name */
  const cell = (row, name) => row[header.indexOf(name)] ?? "";
  const known = new Map(entries.map((entry) => [String(entry.number), entry]));
  /** @type {Map<number, ScoreRecord>} */
  const records = new Map();
  let invalid = 0;
  let stale = 0;

  for (const row of rows) {
    const entry = known.get(cell(row, "number"));
    if (entry === undefined) {
      invalid += 1;
      continue;
    }
    /** @type {Record<string, Score>} */
    const scores = {};
    let valid = true;
    for (const id of ids) {
      const raw = cell(row, id);
      if (raw === "") {
        continue;
      }
      const score = validScore(/^\d$/.test(raw) ? Number(raw) : raw);
      if (score === null) {
        valid = false;
      } else {
        scores[id] = score;
      }
    }
    if (!valid) {
      invalid += 1;
    } else if (cell(row, "hints_version") !== entry.version) {
      stale += 1;
    } else {
      records.set(entry.number, {
        version: entry.version,
        scores,
        comment: unguardCell(cell(row, "comment")),
      });
    }
  }
  return { records, imported: records.size, invalid, stale };
}

/** @param {ReadonlyMap<number, ScoreRecord>} state */
export function serializeState(state) {
  return JSON.stringify({ records: Object.fromEntries(state) });
}

/**
 * @param {string} raw
 * @returns {unknown}
 */
function parseJsonOrNull(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 端末内の保存値を検証して、採点を復元する。
 * @param {string | null} raw
 * @param {readonly Entry[]} entries
 * @param {readonly string[]} ids
 * @returns {{ state: Map<number, ScoreRecord>, stale: number }}
 */
export function restoreState(raw, entries, ids) {
  /** @type {Map<number, ScoreRecord>} */
  const state = new Map();
  let stale = 0;
  const parsed = raw === null ? null : parseJsonOrNull(raw);
  const stored = isObject(parsed) ? parsed.records : null;
  if (!isObject(stored)) {
    return { state, stale };
  }
  for (const entry of entries) {
    const value = Object.hasOwn(stored, entry.number)
      ? stored[entry.number]
      : undefined;
    if (!isObject(value)) {
      continue;
    }
    if (value.version !== entry.version) {
      stale += 1;
      continue;
    }
    const rawScores = isObject(value.scores) ? value.scores : {};
    /** @type {Record<string, Score>} */
    const scores = {};
    for (const id of ids) {
      const score = validScore(rawScores[id]);
      if (score !== null) {
        scores[id] = score;
      }
    }
    state.set(entry.number, {
      version: entry.version,
      scores,
      comment: typeof value.comment === "string" ? value.comment : "",
    });
  }
  return { state, stale };
}

/**
 * @param {readonly Entry[]} entries
 * @param {ReadonlyMap<number, ScoreRecord>} state
 * @param {readonly string[]} ids
 * @param {EntryFilter} filter
 */
export function filterEntries(entries, state, ids, filter) {
  return entries.filter((entry) => {
    const summary = summarizeRecord(state.get(entry.number), ids);
    return (
      (filter.generation === undefined ||
        entry.generation === filter.generation) &&
      (!filter.unscoredOnly || !summary.complete) &&
      (!filter.priorityOnly || entry.note !== undefined) &&
      (!filter.needsFixOnly || summary.needsFix)
    );
  });
}

/**
 * @param {readonly Entry[]} entries
 * @param {ReadonlyMap<number, ScoreRecord>} state
 * @param {readonly string[]} ids
 */
export function progressOf(entries, state, ids) {
  /** @type {Map<number, { generation: number, scored: number, total: number }>} */
  const generations = new Map();
  let scored = 0;
  let needsFix = 0;
  for (const entry of entries) {
    const summary = summarizeRecord(state.get(entry.number), ids);
    const generation = generations.get(entry.generation) ?? {
      generation: entry.generation,
      scored: 0,
      total: 0,
    };
    generation.total += 1;
    generation.scored += summary.complete ? 1 : 0;
    generations.set(entry.generation, generation);
    scored += summary.complete ? 1 : 0;
    needsFix += summary.needsFix ? 1 : 0;
  }
  return {
    scored,
    total: entries.length,
    needsFix,
    byGeneration: [...generations.values()],
  };
}

/**
 * @param {string} key
 * @returns {Score | null}
 */
export function scoreFromKey(key) {
  if (key === "0") {
    return "NA";
  }
  return /^[1-5]$/.test(key) ? Number(key) : null;
}

/**
 * 次の未採点の観点に評点を付ける。すべて埋まっていれば変えない。
 * @param {ScoreRecord | undefined} record
 * @param {string} version
 * @param {readonly string[]} ids
 * @param {Score | null} score
 * @returns {{ record: ScoreRecord, complete: boolean }}
 */
export function applyScore(record, version, ids, score) {
  const current = record ?? { version, scores: {}, comment: "" };
  const target = ids.find((id) => current.scores[id] === undefined);
  const next =
    target === undefined || score === null
      ? current
      : { ...current, scores: { ...current.scores, [target]: score } };
  return { record: next, complete: summarizeRecord(next, ids).complete };
}

/**
 * 今の番号より後の最初の種族と、そのページを返す。
 * @param {readonly Entry[]} filtered
 * @param {number} currentNumber
 * @param {number} pageSize
 * @returns {{ number: number, page: number } | null}
 */
export function nextTarget(filtered, currentNumber, pageSize) {
  const index = filtered.findIndex(({ number }) => number > currentNumber);
  const target = filtered[index];
  return target === undefined
    ? null
    : { number: target.number, page: Math.floor(index / pageSize) };
}

/**
 * 属性と子を指定して要素を作る。文字列は textContent として扱われる。
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Partial<HTMLElementTagNameMap[K]>} properties
 * @param {(Node | string)[]} [children]
 * @returns {HTMLElementTagNameMap[K]}
 */
function h(tag, properties = {}, children = []) {
  const element = document.createElement(tag);
  Object.assign(element, properties);
  element.append(...children);
  return element;
}

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function byId(id) {
  return /** @type {T} */ (document.getElementById(id));
}

function mount() {
  /** @type {{ entries: Entry[], criteria: { id: string, label: string, anchors: { high: string, middle: string, low: string } }[] }} */
  const { entries, criteria } = JSON.parse(
    byId("review-data").textContent ?? "",
  );
  const ids = criteria.map(({ id }) => id);
  const byNumber = new Map(entries.map((entry) => [entry.number, entry]));

  /** @type {HTMLSelectElement} */
  const generationSelect = byId("filter-generation");
  /** @type {HTMLInputElement} */
  const unscoredOnly = byId("filter-unscored");
  /** @type {HTMLInputElement} */
  const priorityOnly = byId("filter-priority");
  /** @type {HTMLInputElement} */
  const needsFixOnly = byId("filter-needs-fix");
  /** @type {HTMLInputElement} */
  const importInput = byId("import-csv");
  /** @type {HTMLButtonElement} */
  const previousPage = byId("previous-page");
  /** @type {HTMLButtonElement} */
  const nextPage = byId("next-page");
  const cards = byId("cards");
  const status = byId("status");
  const progress = byId("progress");
  const pageLabel = byId("page-label");

  /** @param {string} message */
  const showStatus = (message) => {
    status.textContent = message;
  };

  const readStored = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeState(state));
    } catch {
      showStatus("採点を保存できません。CSV を書き出してください");
    }
  };

  const restored = restoreState(readStored(), entries, ids);
  let state = restored.state;
  let page = 0;
  /** @type {number | undefined} */
  let activeNumber;

  const currentFilter = () => ({
    generation:
      generationSelect.value === ""
        ? undefined
        : Number(generationSelect.value),
    unscoredOnly: unscoredOnly.checked,
    priorityOnly: priorityOnly.checked,
    needsFixOnly: needsFixOnly.checked,
  });
  const filtered = () => filterEntries(entries, state, ids, currentFilter());

  /** @param {number} number */
  const card = (number) =>
    /** @type {HTMLElement | null} */ (
      cards.querySelector(`[data-testid="card-${number}"]`)
    );

  const renderProgress = () => {
    const { scored, total, needsFix, byGeneration } = progressOf(
      entries,
      state,
      ids,
    );
    const generations = byGeneration
      .map((g) => `第 ${g.generation} 世代 ${g.scored}/${g.total}`)
      .join("、");
    progress.textContent = `採点済み ${scored}/${total}(要修正 ${needsFix})。${generations}`;
  };

  /** @param {number} number */
  const updateWarning = (number) => {
    const warning = card(number)?.querySelector(".warning");
    const record = state.get(number);
    if (warning instanceof HTMLElement) {
      warning.hidden = !(
        summarizeRecord(record, ids).needsComment && record?.comment === ""
      );
    }
  };

  /** @param {number | undefined} number */
  const setActive = (number) => {
    if (activeNumber !== undefined) {
      card(activeNumber)?.classList.remove("active");
    }
    activeNumber = number;
    if (number !== undefined) {
      card(number)?.classList.add("active");
    }
  };

  /** @param {Entry} entry */
  const recordOf = (entry) =>
    state.get(entry.number) ?? {
      version: entry.version,
      scores: {},
      comment: "",
    };

  /** @param {Entry} entry @param {ScoreRecord} record */
  const store = (entry, record) => {
    state.set(entry.number, record);
    updateWarning(entry.number);
    renderProgress();
    save();
  };

  /** @param {Entry} entry */
  const renderCard = (entry) => {
    const record = state.get(entry.number);
    const aliases =
      entry.aliases.length > 0 ? `(別名: ${entry.aliases.join("、")})` : "";
    const textarea = h("textarea", {
      rows: 2,
      value: record?.comment ?? "",
      placeholder: "どのヒントのどこが問題か。照合した資料",
      ariaLabel: `No.${entry.number} のコメント`,
    });
    textarea.addEventListener("input", () => {
      store(entry, { ...recordOf(entry), comment: textarea.value });
    });
    const article = h("article", {}, [
      h("h2", {}, [
        `No.${entry.number} ${entry.name} `,
        h("span", { className: "small" }, [
          `第 ${entry.generation} 世代 ${aliases}`,
        ]),
      ]),
      ...(entry.note === undefined
        ? []
        : [h("p", { className: "note" }, [`優先: ${entry.note}`])]),
      h(
        "ol",
        {},
        entry.hints.map((hint, index) =>
          h(
            "li",
            {
              className:
                index === HINT_8_INDEX || index === HINT_9_INDEX ? "hand" : "",
            },
            [hint],
          ),
        ),
      ),
      ...criteria.map(({ id, label, anchors }) =>
        h("fieldset", {}, [
          h("legend", {}, [label]),
          ...SCORE_CHOICES.map((choice) => {
            const radio = h("input", {
              type: "radio",
              name: `${entry.number}-${id}`,
              value: choice,
              checked: String(record?.scores[id]) === choice,
            });
            radio.addEventListener("change", () => {
              const current = recordOf(entry);
              store(entry, {
                ...current,
                scores: {
                  ...current.scores,
                  [id]: choice === "NA" ? "NA" : Number(choice),
                },
              });
            });
            return h("label", {}, [radio, ` ${choice}`]);
          }),
          h("div", { className: "small" }, [
            `5: ${anchors.high} / 3: ${anchors.middle} / 1: ${anchors.low}`,
          ]),
        ]),
      ),
      textarea,
      h("p", { className: "warning", hidden: true }, [
        "どのヒントのどこが問題かをコメントに書いてください",
      ]),
    ]);
    article.dataset.testid = `card-${entry.number}`;
    article.addEventListener("focusin", () => setActive(entry.number));
    article.addEventListener("click", () => setActive(entry.number));
    return article;
  };

  const renderList = () => {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    const shown = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    cards.replaceChildren(...shown.map(renderCard));
    for (const { number } of shown) {
      updateWarning(number);
    }
    const stillShown = shown.some(({ number }) => number === activeNumber);
    activeNumber = stillShown ? activeNumber : shown[0]?.number;
    setActive(activeNumber);
    previousPage.disabled = page === 0;
    nextPage.disabled = page >= pages - 1;
    pageLabel.textContent = `${page + 1} / ${pages} ページ(${list.length} 種)`;
    renderProgress();
  };

  const advance = () => {
    const target = nextTarget(filtered(), activeNumber ?? 0, PAGE_SIZE);
    if (target === null) {
      showStatus("絞り込みの最後の種族です");
      return;
    }
    if (card(target.number) === null) {
      page = target.page;
      renderList();
    }
    setActive(target.number);
    card(target.number)?.scrollIntoView({ block: "start" });
  };

  /** @param {number} number */
  const focusComment = (number) => {
    card(number)?.querySelector("textarea")?.focus();
  };

  /** @param {KeyboardEvent} event */
  const onKeyDown = (event) => {
    // 押しっぱなしで連続して採点しないようにする。
    if (event.isComposing || event.repeat) {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      if (event.key === "Escape") {
        target.blur();
        const summary = summarizeRecord(
          activeNumber === undefined ? undefined : state.get(activeNumber),
          ids,
        );
        if (summary.complete) {
          advance();
        }
      }
      return;
    }
    if (
      target instanceof HTMLSelectElement ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      activeNumber === undefined
    ) {
      return;
    }
    const entry = byNumber.get(activeNumber);
    if (entry === undefined) {
      return;
    }
    if (event.key === "c") {
      event.preventDefault();
      focusComment(entry.number);
      return;
    }
    const score = scoreFromKey(event.key);
    const before = state.get(entry.number);
    if (score === null || summarizeRecord(before, ids).complete) {
      return;
    }
    // コメント欄へ移るときに、押したキーが入力されないようにする。
    event.preventDefault();
    const { record, complete } = applyScore(before, entry.version, ids, score);
    store(entry, record);
    const shownCard = card(entry.number);
    for (const [id, value] of Object.entries(record.scores)) {
      const radio = shownCard?.querySelector(
        `input[name="${entry.number}-${id}"][value="${value}"]`,
      );
      if (radio instanceof HTMLInputElement) {
        radio.checked = true;
      }
    }
    if (!complete) {
      return;
    }
    if (summarizeRecord(record, ids).needsComment && record.comment === "") {
      focusComment(entry.number);
    } else {
      advance();
    }
  };

  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([buildCsv(entries, ids, state)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const anchor = h("a", { href: url, download: `hint-review-${date}.csv` });
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const onImport = async () => {
    const file = importInput.files?.[0];
    if (file === undefined) {
      return;
    }
    try {
      // 別の文字コードで保存された CSV を、文字化けしたまま取り込まない。
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      const { records, imported, invalid, stale } = importCsv(
        text,
        entries,
        ids,
      );
      state = new Map([...state, ...records]);
      save();
      renderList();
      showStatus(
        `${imported} 件を取り込みました(不正な行 ${invalid} 件、ヒントが変わった行 ${stale} 件は採用していません)`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      showStatus(`CSV を取り込めませんでした: ${reason}`);
    } finally {
      importInput.value = "";
    }
  };

  generationSelect.append(
    h("option", { value: "", textContent: "すべて" }),
    ...progressOf(entries, state, ids).byGeneration.map(({ generation }) =>
      h("option", {
        value: String(generation),
        textContent: `第 ${generation} 世代`,
      }),
    ),
  );
  byId("legend").append(
    h(
      "ul",
      {},
      criteria.map(({ label, anchors }) =>
        h("li", {}, [
          `${label}: 5 ${anchors.high} / 3 ${anchors.middle} / 1 ${anchors.low}`,
        ]),
      ),
    ),
  );
  /** @param {number} nextPageIndex */
  const showPage = (nextPageIndex) => {
    page = nextPageIndex;
    renderList();
    window.scrollTo(0, 0);
  };
  for (const control of [
    generationSelect,
    unscoredOnly,
    priorityOnly,
    needsFixOnly,
  ]) {
    control.addEventListener("change", () => showPage(0));
  }
  previousPage.addEventListener("click", () => showPage(page - 1));
  nextPage.addEventListener("click", () => showPage(page + 1));
  byId("export-csv").addEventListener("click", exportCsv);
  importInput.addEventListener("change", onImport);
  document.addEventListener("keydown", onKeyDown);

  renderList();
  if (restored.stale > 0) {
    showStatus(`ヒントが変わった ${restored.stale} 種を未採点に戻しました`);
    save();
  }
}

if (typeof document !== "undefined") {
  mount();
}
