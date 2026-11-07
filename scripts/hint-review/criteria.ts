export type Criterion = {
  /** CSV の列名。 */
  readonly id: string;
  readonly label: string;
  /** 評点 5、3、1 の基準。 */
  readonly anchors: {
    readonly high: string;
    readonly middle: string;
    readonly low: string;
  };
};

/** 採点の観点。すべて高いほど良い。 */
export const CRITERIA: readonly Criterion[] = [
  {
    id: "accuracy",
    label: "手書きの正確さ(ヒント 8、9。資料と照合していなければ NA)",
    anchors: {
      high: "資料と照合して誤りなし",
      middle: "細部に疑いがある",
      low: "明確な誤り(色、形、モチーフ)",
    },
  },
  {
    id: "hint8_strength",
    label: "外見の手がかり(ヒント 6〜8 で思い浮かぶ候補の数)",
    anchors: {
      high: "1〜3 匹",
      middle: "4〜10 匹",
      low: "11 匹以上",
    },
  },
  {
    id: "hint9_strength",
    label: "ヒント 9 の手がかり(ヒント 6〜9 で思い浮かぶ候補の数)",
    anchors: {
      high: "1〜2 匹",
      middle: "3〜5 匹",
      low: "6 匹以上",
    },
  },
  {
    id: "difficulty_order",
    label: "難易度の順序(6 → 10)",
    anchors: {
      high: "順に易しくなる",
      middle: "入れ替わりがあるが許容できる(組をコメントに書く)",
      low: "明らかに逆転している(組をコメントに書く)",
    },
  },
  {
    id: "wording",
    label: "文面の自然さ(全ヒント)",
    anchors: {
      high: "自然である",
      middle: "少し不自然である",
      low: "意味が通らない、直すべき",
    },
  },
  {
    id: "redundancy",
    label: "ヒント 9 の新しさ(ヒント 1〜8 との重なり)",
    anchors: {
      high: "新しい情報だけである",
      middle: "一部が重なるが、新しい情報もある",
      low: "新しい情報がない",
    },
  },
];
