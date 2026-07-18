export type CoverSender = "me" | "them";
export type CoverModel = "auto" | "quick" | "thinking";
export type CoverIntent =
  | "plan"
  | "rewrite"
  | "translate"
  | "summarize"
  | "explain"
  | "checklist"
  | "compare"
  | "brainstorm"
  | "follow-up";

export type CoverMessage = {
  id: string;
  sender: CoverSender;
  text: string;
  createdAt: number;
};

export type CoverConversation = {
  id: string;
  title: string;
  updatedAt: number;
  model: CoverModel;
  messages: CoverMessage[];
};

export type CoverReplyPlan = {
  intent: CoverIntent;
  title: string;
  text: string;
  thinkingMs: number;
  streamIntervalMs: number;
};

export type PresentedTurn = {
  id: string;
  role: "user" | "assistant";
  sender: CoverSender;
  text: string;
  segments: string[];
  messageIds: string[];
  createdAt: number;
};

export type PrivateMessageLike = {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
  sender?: CoverSender;
};

export const COVER_HISTORY_KEY = "local-consultations-v2";
export const COVER_HISTORY_VERSION = 2;
export const MAX_COVER_CONVERSATIONS = 12;

type SeedTurn = Pick<CoverMessage, "sender" | "text">;

const CURATED_CONVERSATIONS: ReadonlyArray<{
  title: string;
  turns: readonly SeedTurn[];
}> = [
  {
    title: "晚间学习计划",
    turns: [
      { sender: "me", text: "帮我安排一个两小时的晚间学习计划，重点是提高专注力。" },
      { sender: "them", text: "可以。建议把两小时分成三个阶段：先用 10 分钟明确目标并清理干扰；接着进行两轮 40 分钟的专注学习，中间休息 10 分钟；最后用 20 分钟复盘、整理笔记并写下明天的第一步。" },
      { sender: "me", text: "两轮学习分别适合做什么？" },
      { sender: "them", text: "第一轮适合处理最需要理解的新内容，例如阅读章节、看课程或推导概念。第二轮适合主动输出，例如做题、复述知识点、制作提纲。先输入再输出，通常比连续阅读更容易形成记忆。" },
      { sender: "me", text: "如果中途总想看手机怎么办？" },
      { sender: "them", text: "把手机放到够不到的位置，并提前开启勿扰模式。学习时准备一张纸，每次想查看消息，就先把念头写下来，等休息时间统一处理。这样不会强迫自己忘掉事情，也不会立即打断任务。" },
      { sender: "me", text: "能整理成一个简单清单吗？" },
      { sender: "them", text: "当然：\n\n- 10 分钟确定目标并收好手机\n- 40 分钟学习新内容\n- 10 分钟休息\n- 40 分钟做题或复述\n- 20 分钟整理笔记和明日任务" },
      { sender: "me", text: "最后复盘时应该记录哪些内容？" },
      { sender: "them", text: "记录三件事就够了：今天真正完成了什么、还有哪个问题没有弄懂、下一次开始时最先做什么。复盘控制在几分钟内，重点是让下次更容易进入状态，而不是写一份很长的总结。" },
    ],
  },
  {
    title: "周末短途出行清单",
    turns: [
      { sender: "me", text: "周末去周边住一晚，帮我列一个轻量行李清单。" },
      { sender: "them", text: "可以按“证件、穿着、洗护、充电、应急”五类准备，尽量控制在一个双肩包内。先看天气，再决定是否带外套和雨具。" },
      { sender: "me", text: "有哪些东西最容易忘？" },
      { sender: "them", text: "最常遗漏的是充电线、备用袜子、常用药和第二天需要的证件。出门前可以按“手机、钥匙、证件、药品”再快速检查一遍。" },
      { sender: "me", text: "整理成可以勾选的版本。" },
      { sender: "them", text: "好的：\n\n- [ ] 身份证件与门票\n- [ ] 一套替换衣物\n- [ ] 牙刷和旅行装洗护\n- [ ] 手机充电器与充电宝\n- [ ] 常用药、纸巾和折叠伞" },
      { sender: "me", text: "如果只带一个小包呢？" },
      { sender: "them", text: "优先保留不能临时替代的东西：证件、手机、药品和充电设备。洗护用品用住宿提供的，衣物选择能重复搭配的一套，体积会小很多。" },
    ],
  },
  {
    title: "项目汇报表达",
    turns: [
      { sender: "me", text: "明天要做项目汇报，怎样让表达更清楚？" },
      { sender: "them", text: "把汇报固定成四段：目标是什么、现在到哪里、遇到什么问题、下一步需要什么。每段先给结论，再补一到两个证据。" },
      { sender: "me", text: "开场应该怎么说？" },
      { sender: "them", text: "可以直接说明目的和结论：今天用五分钟同步当前进度、主要风险和本周决策点。这样听众会先知道接下来要关注什么。" },
      { sender: "me", text: "如果被追问细节怎么办？" },
      { sender: "them", text: "先确认对方问的是事实、原因还是方案，再回答对应层级。暂时没有的数据可以明确说会后核实，不要用未经确认的数字填空。" },
      { sender: "me", text: "给我一个会前检查清单。" },
      { sender: "them", text: "会前确认：\n\n1. 一句话结论能否说清\n2. 关键数字是否有来源\n3. 风险是否配有应对动作\n4. 需要谁做什么决定\n5. 超时后哪些内容可以删减" },
    ],
  },
  {
    title: "建立阅读习惯",
    turns: [
      { sender: "me", text: "我想重新养成阅读习惯，但总坚持不了。" },
      { sender: "them", text: "先把目标从“读完一本书”缩小为“每天在固定时间读十分钟”。习惯早期最重要的是稳定出现，不是一次读很多。" },
      { sender: "me", text: "晚上经常太累怎么办？" },
      { sender: "them", text: "把阅读提前到精力更稳定的时段，例如午休后或通勤时。也可以给晚上准备难度更低的散文或短篇，减少启动阻力。" },
      { sender: "me", text: "需要做读书笔记吗？" },
      { sender: "them", text: "不必每次都写完整笔记。读完只记一句“今天最值得留下的观点”，既能帮助回忆，也不会让记录本身变成负担。" },
      { sender: "me", text: "一周怎么复盘？" },
      { sender: "them", text: "周末看三个指标：实际读了几天、最容易开始的时间、哪类内容最能继续读下去。下周只调整一个变量，例如时间或书的难度。" },
    ],
  },
];

const INTENT_RULES: ReadonlyArray<[CoverIntent, RegExp]> = [
  ["translate", /(翻译|译成|英文怎么说|translate|translation)/i],
  ["rewrite", /(改写|润色|优化.{0,4}(表达|文案|文字)|换个.{0,8}说法|语气|rewrite|polish)/i],
  ["summarize", /(总结|概括|摘要|提炼|要点|summari[sz]e|tl;?dr)/i],
  ["compare", /(比较|对比|区别|差异|优缺点|哪个好|versus|\bvs\.?\b|compare)/i],
  ["checklist", /(清单|检查表|待办|步骤列表|列出|checklist)/i],
  ["brainstorm", /(头脑风暴|灵感|点子|创意|起名|想几个|brainstorm|ideas?)/i],
  ["plan", /(计划|安排|规划|日程|路线|方案|怎么做|如何开始|plan|schedule)/i],
  ["explain", /(解释|说明|为什么|原理|是什么|什么意思|通俗|explain|why|what is)/i],
];

function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function makeId(prefix = "local") {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clip(value: string, length = 42) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > length ? `${compact.slice(0, length)}…` : compact;
}

function topicFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/^(请|麻烦|可以|能不能|能否|帮我|请你)+/g, "")
    .replace(/[？?。！!]+$/g, "")
    .trim();
  return clip(cleaned || "这个问题", 56);
}

function titleFor(prompt: string, intent: CoverIntent) {
  const topic = topicFromPrompt(prompt);
  const prefixes: Record<CoverIntent, string> = {
    plan: "规划",
    rewrite: "文字润色",
    translate: "翻译",
    summarize: "内容总结",
    explain: "概念解释",
    checklist: "实用清单",
    compare: "方案比较",
    brainstorm: "创意构思",
    "follow-up": "问题梳理",
  };
  return clip(`${prefixes[intent]}：${topic}`, 26);
}

function detectIntent(prompt: string): CoverIntent {
  for (const [intent, pattern] of INTENT_RULES) {
    if (pattern.test(prompt)) return intent;
  }
  return "follow-up";
}

function buildReply(intent: CoverIntent, topic: string, variant: number) {
  const variants: Record<CoverIntent, Array<(subject: string) => string>> = {
    plan: [
      (subject) => `可以把“${subject}”拆成三个阶段：\n\n1. **先定义结果**：写下完成时应看到的具体成果。\n2. **再安排最小行动**：先做一个 20 分钟内能完成的起步任务。\n3. **最后留出复盘**：检查进度，只调整下一步，不一次改动全部计划。\n\n如果时间有限，优先完成第一项可交付成果。`,
      (subject) => `针对“${subject}”，建议用倒推法安排：\n\n- 明确截止时间和必须完成的部分\n- 把工作拆成准备、执行、检查三段\n- 每段只保留一个明确目标\n- 预留约 20% 时间处理意外\n\n先告诉我可用时间，我可以继续把它排成具体日程。`,
      (subject) => `先从一个可执行版本开始处理“${subject}”：今天只完成资料收集和第一步，下一次集中完成主体，最后单独检查。这样每次开始都有明确入口，也更容易判断哪里被卡住。`,
    ],
    rewrite: [
      (subject) => `可以。若想让“${subject}”更自然，建议先删掉重复铺垫，把结论放到前面，再用一两句补充原因。\n\n**推荐结构**\n\n“先说结论。随后说明最关键的依据，最后给出下一步或明确请求。”\n\n把原文贴出来后，我可以按这个结构给出完整版本。`,
      (subject) => `我可以从三个层面处理“${subject}”：信息不变、句子更短、语气更符合对象。你可以同时告诉我使用场景，例如邮件、汇报或聊天，我会避免把它改得过于正式。`,
      (subject) => `如果目标是更有说服力，可以把“${subject}”改成“结论—依据—行动”的顺序，并把模糊词换成具体对象和时间。请贴出原句，我会保留原意提供简洁版与自然版。`,
    ],
    translate: [
      (subject) => `可以翻译“${subject}”。为避免语气偏差，请补充目标语言和使用场景；同一句话在商务邮件、日常聊天和正式材料里的表达会不同。我会给出直译和自然表达两个版本。`,
      (subject) => `处理“${subject}”时，我会先保留事实和专有名词，再调整成目标语言的自然语序。请把原文与目标语言发来；如果没有特别说明，我会采用清晰、不过度正式的语气。`,
      (subject) => `可以。请提供“${subject}”的完整内容，并说明是否要保留段落、列表和称呼。我会把容易产生歧义的词单独标出来，便于你确认。`,
    ],
    summarize: [
      (subject) => `总结“${subject}”时，可以先抓三类信息：\n\n- **结论**：作者最终想说明什么\n- **依据**：支持结论的关键事实\n- **行动**：读完后需要做什么\n\n把原文贴过来，我会先给三句话摘要，再列关键要点。`,
      (subject) => `我可以把“${subject}”整理成“1 句结论 + 3 个要点 + 1 个待确认问题”。这种格式适合快速阅读，也能避免只压缩字数却遗漏重点。`,
      (subject) => `可以。为了让“${subject}”的摘要真正有用，请告诉我读者是谁、希望多长。没有额外要求时，我会保留数字、结论和风险，删除例子与重复说明。`,
    ],
    explain: [
      (subject) => `可以先把“${subject}”理解成一个解决特定问题的工具：它为什么出现、由哪些部分组成、在什么情况下有用。\n\n我可以继续用一个日常类比、一个具体例子和一个常见误区来展开。你现在最想弄清的是定义还是实际用法？`,
      (subject) => `解释“${subject}”可以分三层：先用一句话给定义，再说明背后的因果关系，最后看一个反例。这样既能快速理解，也能知道这个概念的边界。`,
      (subject) => `关于“${subject}”，建议不要先背术语。先问：输入是什么、过程发生了什么、结果如何判断。把这三个问题答清，通常就能理解它的核心。`,
    ],
    checklist: [
      (subject) => `这里是一份处理“${subject}”的基础清单：\n\n- [ ] 明确目标与截止时间\n- [ ] 准备必要资料或工具\n- [ ] 完成最小可用版本\n- [ ] 检查容易遗漏的细节\n- [ ] 记录下一步和负责人\n\n如果你告诉我具体场景，我可以把每项改得更贴合。`,
      (subject) => `可以按开始前、进行中、结束后三段检查“${subject}”：\n\n1. 开始前确认目标、时间和材料\n2. 进行中只跟踪关键进度与阻塞\n3. 结束后核对结果、备份和后续动作`,
      (subject) => `精简版清单：\n\n- 目标是否具体\n- 资源是否齐全\n- 第一步是否足够小\n- 结果是否有人复核\n- 后续是否已有安排\n\n这五项可以覆盖“${subject}”的大部分遗漏风险。`,
    ],
    compare: [
      (subject) => `比较“${subject}”时，先不要只看“哪个好”，而要看适配条件：\n\n| 维度 | 重点 |\n| --- | --- |\n| 成本 | 初始投入与长期维护 |\n| 效率 | 上手速度与完成质量 |\n| 风险 | 最差情况是否可接受 |\n| 弹性 | 需求变化后是否好调整 |\n\n把两个具体选项告诉我，我可以给出更明确的取舍建议。`,
      (subject) => `“${subject}”适合用加权比较：先列出最重要的三项标准，再按重要程度排序。若一个方案在首要标准上明显领先，就不必被次要优点干扰。`,
      (subject) => `可以从短期收益和长期代价两边看“${subject}”。我建议分别写出：立即得到什么、持续付出什么、失败后是否容易回退。补充具体选项后，我会整理成对照表。`,
    ],
    brainstorm: [
      (subject) => `围绕“${subject}”，可以从五个方向发散：\n\n1. 更省时间的版本\n2. 更低成本的版本\n3. 更有记忆点的版本\n4. 适合第一次尝试的版本\n5. 与常见做法相反的版本\n\n你选一个方向，我再给出一组更具体的点子。`,
      (subject) => `先给“${subject}”三个不同思路：一个稳妥可执行、一个强调体验、一个有明显反差。接下来可以按目标人群和限制条件，把其中一个扩展成完整方案。`,
      (subject) => `可以用“替换、组合、缩小、反转”四种方法为“${subject}”找新点子。先不用判断好坏，每类写三个，再筛选同时满足新鲜感和可执行性的方案。`,
    ],
    "follow-up": [
      (subject) => `我可以帮你梳理“${subject}”。为了给出更准确的回答，请补充两个信息：你希望最后得到什么结果，以及目前最大的限制是什么？`,
      (subject) => `关于“${subject}”，我还需要确认使用场景。它是用于做决定、解决问题，还是整理表达？告诉我你已经尝试过什么，我会从下一步开始回答。`,
      (subject) => `可以继续。请把“${subject}”里最想解决的一点说得具体些，例如对象、时间或期望格式。我会据此给出直接可用的建议，而不是泛泛而谈。`,
    ],
  };
  const options = variants[intent];
  return options[variant % options.length](topic);
}

export function generateCoverReply(prompt: string): CoverReplyPlan {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  const intent = detectIntent(normalized);
  const hash = stableHash(normalized || "empty");
  const text = buildReply(intent, topicFromPrompt(normalized), hash);
  return {
    intent,
    title: titleFor(normalized, intent),
    text,
    thinkingMs: 420 + (hash % 560),
    streamIntervalMs: 24 + (text.length % 23),
  };
}

export function groupPrivateMessages(
  messages: readonly PrivateMessageLike[],
  localSenderId: string,
): PresentedTurn[] {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const turns: PresentedTurn[] = [];
  for (const message of sorted) {
    const sender: CoverSender = message.sender || (message.senderId === localSenderId ? "me" : "them");
    const previous = turns.at(-1);
    if (previous?.sender === sender) {
      previous.segments.push(message.text);
      previous.messageIds.push(message.id);
      previous.text = previous.segments.join("\n\n");
      continue;
    }
    turns.push({
      id: `turn-${message.id}`,
      role: sender === "me" ? "user" : "assistant",
      sender,
      text: message.text,
      segments: [message.text],
      messageIds: [message.id],
      createdAt: message.createdAt,
    });
  }
  return turns;
}

function createConversation(
  title: string,
  turns: readonly SeedTurn[],
  now: number,
  model: CoverModel = "auto",
): CoverConversation {
  const firstTimestamp = now - (turns.length - 1) * 45_000;
  return {
    id: makeId("conversation"),
    title,
    updatedAt: now,
    model,
    messages: turns.map((turn, index) => ({
      id: makeId("message"),
      sender: turn.sender,
      text: turn.text,
      createdAt: firstTimestamp + index * 45_000,
    })),
  };
}

function isCoverMessage(value: unknown): value is CoverMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<CoverMessage>;
  return typeof message.id === "string"
    && (message.sender === "me" || message.sender === "them")
    && typeof message.text === "string"
    && typeof message.createdAt === "number";
}

function isCoverConversation(value: unknown): value is CoverConversation {
  if (!value || typeof value !== "object") return false;
  const conversation = value as Partial<CoverConversation>;
  return typeof conversation.id === "string"
    && typeof conversation.title === "string"
    && typeof conversation.updatedAt === "number"
    && (conversation.model === "auto" || conversation.model === "quick" || conversation.model === "thinking")
    && Array.isArray(conversation.messages)
    && conversation.messages.every(isCoverMessage);
}

export function normalizeCoverHistory(value: unknown): CoverConversation[] {
  if (!value || typeof value !== "object") return [];
  const envelope = value as { version?: unknown; conversations?: unknown };
  if (envelope.version !== COVER_HISTORY_VERSION || !Array.isArray(envelope.conversations)) return [];
  return envelope.conversations
    .filter(isCoverConversation)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_COVER_CONVERSATIONS)
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => ({ ...message })),
    }));
}

export function serializeCoverHistory(conversations: readonly CoverConversation[]) {
  return JSON.stringify({
    version: COVER_HISTORY_VERSION,
    conversations: [...conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_COVER_CONVERSATIONS),
  });
}

export function selectEmergencyCover(
  history: readonly CoverConversation[],
  now = Date.now(),
  seed = now,
): CoverConversation {
  const credible = history
    .filter((conversation) => conversation.messages.some((message) => message.sender === "them" && message.text.length > 30))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (credible) {
    return {
      ...credible,
      updatedAt: now,
      messages: credible.messages.map((message) => ({ ...message })),
    };
  }
  const curated = CURATED_CONVERSATIONS[Math.abs(seed) % CURATED_CONVERSATIONS.length];
  return createConversation(curated.title, curated.turns, now);
}

export const COVER_MESSAGE_COUNT = CURATED_CONVERSATIONS[0].turns.length;

export function createCoverMessages(now = Date.now()): CoverMessage[] {
  return createConversation(
    CURATED_CONVERSATIONS[0].title,
    CURATED_CONVERSATIONS[0].turns,
    now,
  ).messages;
}
