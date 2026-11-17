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
];

/**
 * Model, product and vendor names. In this category a title that names a model is
 * almost always a free-credit announcement, so it counts as decisive on its own.
 */
const aiBrandPattern =
    /\b(?:ai|api|gpt|claude|gemini|deepseek|glm|qwen|kimi|grok|llama|llm|token|codex|sora|qoder|cursor|copilot|windsurf|cline|sonnet|opus)\b|智谱|通义|豆包|元宝|文心|混元|星火|可灵|硅基流动|火山方舟/;

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

    const weakHit = weakKeywords.find((keyword) => title.includes(keyword));
    if (weakHit && aiContextPattern.test(title)) {
        return { skip: true, reason: `weak:${weakHit}+ai` };
    }

    return { skip: false };
}
