import { describe, expect, it } from "vitest";
import { CRITERIA } from "./criteria.ts";
import { renderReviewSheet } from "./render-sheet.ts";

const CLIENT = "console.log('client');";

function entry(number: number, hint = "架空のヒント") {
  return {
    number,
    name: `カセツモン${number}`,
    aliases: [],
    generation: 1,
    hints: Array.from({ length: 10 }, () => hint),
    version: "v00000000",
  };
}

function render(entries = [entry(1)], client = CLIENT) {
  return renderReviewSheet({ entries, criteria: CRITERIA }, client);
}

describe("renderReviewSheet", () => {
  it("R-29: ヒントに </script> を含むデータでも埋め込みが閉じない", () => {
    const html = render([entry(1, "</script><script>alert(1)</script>")]);
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    const json =
      /<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/.exec(
        html,
      )?.[1];
    expect(JSON.parse(json ?? "").entries[0].hints[0]).toBe(
      "</script><script>alert(1)</script>",
    );
  });

  it("R-30: CSP で外部との通信を禁止する", () => {
    const html = render();
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain("connect-src");
  });

  it("R-31: 外部の URL を参照しない", () => {
    expect(render()).not.toMatch(/(?:src|href)=|https?:\/\//);
  });

  it("R-32: 渡したすべての種族を含む", () => {
    const html = render([entry(1), entry(2), entry(3)]);
    for (const name of ["カセツモン1", "カセツモン2", "カセツモン3"]) {
      expect(html).toContain(name);
    }
  });

  it("R-33: ブラウザ用のコードに </script があればエラーにする", () => {
    expect(() => render([entry(1)], "const a = '</SCRIPT>';")).toThrow();
  });
});
