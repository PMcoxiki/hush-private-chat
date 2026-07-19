const QUESTION_REPLIES = [
  "可以先把问题拆成目标、限制和下一步三个部分。这样既能快速形成结论，也方便随后补充更具体的执行建议。",
  "这个问题适合先确认真正想解决的结果，再比较可选路径。我会优先保留简单、可执行且容易验证的方案。",
  "可以从现状、原因和行动三个层次来看。先确定最关键的影响因素，再给出一两个可以马上尝试的步骤。",
  "建议先缩小讨论范围，明确对象和时间条件。信息足够后，就能给出更直接的判断，而不是停留在泛泛建议。",
] as const;

const TIME_REPLIES = [
  "可以把时间要求作为主要约束：先确定最小可完成结果，再安排执行顺序，并为检查和调整留出一点余量。",
  "如果时间有限，优先处理最影响结果的一项，其余内容按重要程度顺延。这样能减少临时变化带来的返工。",
  "建议按开始、推进和复盘三个时间段安排，每段只保留一个明确目标，执行时会更容易保持节奏。",
  "可以先锁定截止时间，再倒推准备、执行和确认节点。每个节点都写成一个能够直接完成的动作。",
] as const;

const CONSTRAINT_REPLIES = [
  "明白，我会把这个限制作为前提保留。接下来先排除不符合条件的做法，再从剩余方案中选择风险更低的一种。",
  "这项约束很重要。可以先明确哪些内容不能变化，再优化仍有调整空间的部分，避免解决一个问题又引入新的偏差。",
  "可以在不改变核心条件的前提下处理：先保留必要信息，再简化步骤，最后检查是否触碰了限制边界。",
  "建议把限制条件单独列出来，并在每一步完成后快速核对。这样更容易确保最终结果没有偏离原始要求。",
] as const;

const STRUCTURE_REPLIES = [
  "可以整理成一个简洁清单：先确认目标和材料，再按优先级逐项处理，最后检查遗漏并记录下一步。",
  "建议分成准备、执行和检查三部分。每部分只放最必要的动作，整体会更清楚，也方便逐项确认。",
  "可以先列出所有事项，再按重要性和先后关系排序。优先保留会直接影响结果的步骤，其余作为补充。",
  "这部分适合用分点结构表达：先给结论，再列关键依据，最后补充一个明确的行动建议。",
] as const;

const GENERAL_REPLIES = [
  "可以。先保留最重要的信息，再把它整理成清晰的结论和下一步建议，这样阅读时会更容易抓住重点。",
  "明白。我会从实际目标出发，先说明核心判断，再补充执行方法和需要留意的边界条件。",
  "这部分可以进一步梳理。建议先确定优先级，然后选择一个成本较低、容易验证的步骤开始推进。",
  "可以继续沿这个方向展开：先总结当前信息，再找出最关键的变量，最后给出能够直接行动的建议。",
] as const;

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function generatePrivateAiReply(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const replies = /时间|今天|明天|周末|本周|下周|日期|几点|多久/.test(normalized)
    ? TIME_REPLIES
    : /不要|不能|避免|限制|必须|只要|保留|不改/.test(normalized)
      ? CONSTRAINT_REPLIES
      : /清单|列表|步骤|列出|整理|几个|分点/.test(normalized)
        ? STRUCTURE_REPLIES
        : /[？?]|怎么|如何|为什么|是否|什么/.test(normalized)
          ? QUESTION_REPLIES
          : GENERAL_REPLIES;
  return replies[stableHash(normalized || "empty") % replies.length];
}
