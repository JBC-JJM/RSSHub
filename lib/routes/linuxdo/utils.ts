// linux.do's welfare category is dominated by AI relay ("公益站"/"中转站") promos,
// free credit giveaways and invite codes. The rules below decide whether a topic is
// such a post, based on its title only: post bodies often quote the relay template,
// so matching the body would produce false positives.

/**
 * Words that are decisive on their own: they only show up in relay / credit-farming posts.
 */
const strongKeywords = [
    '公益站',
    '公益发帖',
    '公益推广',
    '公益平台',
    '公益api',
    '公益key',
    '中转站',
    '中转api',
    '中转服务',
    '中转通道',
    '富可敌国',
    '拼车',
    '稳定通道',
    '高速通道',
    '极速通道',
    '直连通道',
    '专用通道',
    '缓存命中',
    '开放注册',
    '邀请码',
    '新人送',
    '送额度',
    '送美刀',
    '送美金',
    '送美元',
    '送余额',
    '送token',
    '送 token',
    '送key',
    '送 key',
    '留id',
    '留 id',
    '福利额度',
    '免费额度',
    '免费token',
    '免费模型',
    '免费api',
    '免费key',
    '倍率',
    '刷额度',
    '白嫖',
    '无限蹬',
    '发key',
    '发 key',
    'apikey',
    'api key',
    'key池',
    '密钥池',
    '美刀',
    '刀乐',
    '已失效',
    '已过期',
    'token',
    // Expired / finished giveaways: worth nothing once the quota is gone.
    '已无',
    '已结束',
    '已完结',
    '已领完',
    '已抢完',
    '已兑完',
    '已发完',
    '已送完',
    '已截止',
    '已关闭',
    '已下架',
    '名额已满',
    '已拉闸',
    '已开奖',
    // Giveaway / farming verbs and nouns that only appear in credit-farming posts.
    'team',
    '蹬',
    '号池',
    '送点',
    '速蹬',
    '注册送',
];

/**
 * Model, product and vendor names. In this category a title that names a model is
 * almost always a free-credit announcement, so it counts as decisive on its own.
 * The trailing `(?![a-z])` instead of `\b` is deliberate: versioned names such as
 * `gpt6.2`, `gpt4o` and `claude3` put a digit right after the brand, where `\b` fails.
 *
 * `chatgpt` must be listed explicitly: `gpt` is preceded by a letter there, so neither
 * `\b` nor the lookahead would match it inside `chatgpt`.
 *
 * Subscription tier words (`premium`, `ultra`) are included because AI plan giveaways
 * are often titled by tier alone, e.g. "抽个 Premium 名额". `plus` and `max` are
 * deliberately absent: they are just as often e-commerce loyalty tiers (京东 Plus,
 * 山姆 Max), so they live in `ambiguousTierPattern` instead.
 */
const aiBrandPattern =
    /\b(?:chatgpt|ai|api|gpt|claude|gemini|deepseek|glm|qwen|kimi|grok|llama|llm|token|codex|sora|qoder|cursor|copilot|windsurf|cline|sonnet|opus|minimax|sol|premium|ultra)(?![a-z])|智谱|通义|豆包|元宝|文心|混元|星火|可灵|硅基流动|火山方舟|阶跃星辰|谷歌|海螺/;

/**
 * Tier words that could belong to either an AI plan or a shopping membership.
 * They only count as AI noise when the title also carries an AI context word.
 */
const ambiguousTierPattern = /\b(?:plus|max)\b/i;

/**
 * Giveaway phrasing: "抽 N 个名额", "抽奖", "开奖", "roll N".
 * On its own this is not decisive — banks and carriers run real lotteries — so it is
 * combined with `aiContextPattern` or a brand name, the same way `weakKeywords` is.
 */
const giveawayPattern = /抽\s*\d+\s*个|抽奖|抽取|开奖|名额|roll\s*\d+/i;

/**
 * Generic words that only mean "AI freebie" when combined with one of the patterns above.
 */
const aiContextPattern = /模型|大模型|智能体|算力|提示词|中转/;

/**
 * Ordinary welfare words. They are dropped only when the title also mentions AI,
 * so bank / telecom / transport deals survive.
 */
const weakKeywords = ['额度', '积分', '赠送', '免费', '重置', '优惠码', '折扣', '羊毛', '薅', '领取', '兑换', '免费开放', '试用', '体验金'];

const normalize = (title: string) => title.toLowerCase().replaceAll(/\s+/g, ' ');

export type WelfareVerdict = {
    skip: boolean;
    reason?: string;
};

export function classifyWelfareTitle(rawTitle: string): WelfareVerdict {
    const title = normalize(rawTitle);

    const keywordHit = strongKeywords.find((keyword) => title.includes(keyword));
    if (keywordHit) {
        return { skip: true, reason: `strong:${keywordHit}` };
    }

    if (aiBrandPattern.test(title)) {
        return { skip: true, reason: 'brand' };
    }

    // A lottery only counts as AI noise when the title also talks about models/relay,
    // otherwise bank and carrier campaigns ("中国银行 2233 卡抽奖活动") would be dropped.
    if (giveawayPattern.test(title) && aiContextPattern.test(title)) {
        return { skip: true, reason: 'giveaway+ai' };
    }

    // "Plus" is a coin flip between an AI plan and a shopping membership, so it needs
    // an explicit AI context word ("ChatGPT Plus", "Plus 会员 模型").
    if (ambiguousTierPattern.test(title) && aiContextPattern.test(title)) {
        return { skip: true, reason: 'tier+ai' };
    }

    const weakHit = weakKeywords.find((keyword) => title.includes(keyword));
    if (weakHit && aiContextPattern.test(title)) {
        return { skip: true, reason: `weak:${weakHit}+ai` };
    }

    return { skip: false };
}
