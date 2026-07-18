export type CoverMessage = {
  id: string;
  sender: "me" | "them";
  text: string;
  createdAt: number;
};

const COVER_TURNS = [
  {
    sender: "me",
    text: "帮我安排一个两小时的晚间学习计划，重点是提高专注力。",
  },
  {
    sender: "them",
    text: "可以。建议把两小时分成三个阶段：先用 10 分钟明确目标并清理干扰；接着进行两轮 40 分钟的专注学习，中间休息 10 分钟；最后用 20 分钟复盘、整理笔记并写下明天的第一步。",
  },
  {
    sender: "me",
    text: "两轮学习分别适合做什么？",
  },
  {
    sender: "them",
    text: "第一轮适合处理最需要理解的新内容，例如阅读章节、看课程或推导概念。第二轮适合主动输出，例如做题、复述知识点、制作提纲。先输入再输出，通常比连续阅读更容易形成记忆。",
  },
  {
    sender: "me",
    text: "如果中途总想看手机怎么办？",
  },
  {
    sender: "them",
    text: "把手机放到够不到的位置，并提前开启勿扰模式。学习时准备一张纸，每次想查看消息，就先把念头写下来，等休息时间统一处理。这样不会强迫自己忘掉事情，也不会立即打断任务。",
  },
  {
    sender: "me",
    text: "能整理成一个简单清单吗？",
  },
  {
    sender: "them",
    text: "当然：① 10 分钟确定目标并收好手机；② 40 分钟学习新内容；③ 10 分钟休息；④ 40 分钟做题或复述；⑤ 20 分钟整理笔记和明日任务。每轮只保留一个明确目标。",
  },
  {
    sender: "me",
    text: "最后复盘时应该记录哪些内容？",
  },
  {
    sender: "them",
    text: "记录三件事就够了：今天真正完成了什么、还有哪个问题没有弄懂、下一次开始时最先做什么。复盘控制在几分钟内，重点是让下次更容易进入状态，而不是写一份很长的总结。",
  },
] as const satisfies ReadonlyArray<Pick<CoverMessage, "sender" | "text">>;

export const COVER_MESSAGE_COUNT = COVER_TURNS.length;

export function createCoverMessages(now = Date.now()): CoverMessage[] {
  const firstTimestamp = now - (COVER_TURNS.length - 1) * 45_000;
  return COVER_TURNS.map((turn, index) => ({
    id: crypto.randomUUID(),
    sender: turn.sender,
    text: turn.text,
    createdAt: firstTimestamp + index * 45_000,
  }));
}
