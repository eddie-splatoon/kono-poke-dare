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
    label: "手書きの正確さ(ヒント 6、9)",
    anchors: {
      high: "誤りなし",
      middle: "細部に疑いがある",
      low: "明確な誤り(色、形、モチーフ)",
    },
  },
  {
    id: "hint6_strength",
    label: "ヒント 6 の強さ",
    anchors: {
      high: "候補を絞れるが特定はできない",
      middle: "やや特定しやすい、または少し弱い",
      low: "これだけで特定できる、または全く絞れない",
    },
  },
  {
    id: "hint9_strength",
    label: "ヒント 9 の手がかり",
    anchors: {
      high: "ほぼ特定できる",
      middle: "手がかりとして弱めである",
      low: "進化前の名前だけなど、ヒント 6 より弱い",
    },
  },
  {
    id: "difficulty_order",
    label: "難易度の順序(6 → 10)",
    anchors: {
      high: "順に易しくなる",
      middle: "一部が入れ替わるが許容できる",
      low: "明らかに逆転している",
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
];
