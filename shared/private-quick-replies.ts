export const PRIVATE_QUICK_REPLIES: ReadonlyArray<string> = [
  "可以。先把目标和限制条件说清楚，我再按步骤整理。",
  "我建议先拆成三部分：现状、主要问题和下一步行动。",
  "这个思路基本可行，不过还需要确认时间范围和优先级。",
  "如果你愿意，可以把具体内容发来，我帮你整理成更清晰的版本。",
  "先给一个简要结论：可以推进，但最好保留一个可回退方案。",
  "我会从可行性、风险和执行成本三个角度分析。",
  "下面先列出关键点，再根据你的反馈补充细节。",
  "这个问题没有唯一答案，可以先从最容易验证的部分开始。",
];

export function mergePrivateQuickReply(draft: string, reply: string): string {
  const current = draft.trim();
  const selected = reply.trim();
  if (!current) return selected;
  if (!selected) return current;
  return `${current}\n\n${selected}`;
}
