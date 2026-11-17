import { load } from 'cheerio';

import { config } from '@/config';
import type { Data, DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

import { classifyWelfareTitle } from './utils';

const feedUrl = 'https://linux.do/c/welfare/36.rss';
const categoryUrl = 'https://linux.do/c/welfare/36';

export const route: Route = {
    path: '/welfare',
    categories: ['bbs'],
    example: '/linuxdo/welfare',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['linux.do/c/welfare/36'],
            target: '/welfare',
        },
    ],
    name: '福利羊毛（过滤 AI 中转）',
    maintainers: ['JBC-JJM'],
    handler,
    description: `抓取 \`linux.do\` 福利羊毛板块的官方 RSS，并按标题过滤掉 AI 中转站、公益站、邀请码、赠送额度一类帖子。

过滤只在标题上做，不扫描正文（正文常引用公益站模板，容易误伤）。强特征词（如 \`公益站\`、\`中转站\`、\`邀请码\`、\`token\`、\`已失效\`）直接过滤；\`额度\`、\`积分\`、\`免费\` 这类泛词只有同时出现 AI 相关词（模型名、\`AI\`、\`API\` 等）时才过滤，所以移动话费、银行立减金、交通卡等非 AI 福利会保留。

规则在 \`lib/routes/linuxdo/utils.ts\` 里，按需增删即可。`,
};

async function handler(): Promise<Data> {
    const xml = await cache.tryGet(
        'linuxdo:welfare:rss',
        () =>
            ofetch<string>(feedUrl, {
                responseType: 'text',
                headers: {
                    accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
                },
            }),
        config.cache.routeExpire
    );

    const $ = load(xml, { xmlMode: true });
    const channel = $('rss > channel');

    const item: DataItem[] = channel
        .children('item')
        .toArray()
        .map((element) => {
            const entry = $(element);
            const link = entry.children('link').text().trim();
            const pubDate = entry.children('pubDate').text().trim();

            return {
                title: entry.children('title').text().trim(),
                link,
                guid: entry.children('guid').text().trim() || link,
                description: entry.children('description').text(),
                pubDate: pubDate ? parseDate(pubDate) : undefined,
                author: entry
                    .children()
                    .filter((_, child) => child.name.endsWith(':creator'))
                    .text()
                    .trim() || undefined,
                category: entry
                    .children('category')
                    .toArray()
                    .map((category) => $(category).text()),
            };
        })
        .filter((entry) => !classifyWelfareTitle(entry.title ?? '').skip);

    return {
        title: 'Linux.do - 福利羊毛（已过滤 AI 中转/赠送）',
        link: categoryUrl,
        description: 'Linux.do 福利羊毛板块，已按标题过滤 AI 中转站与赠送额度类帖子。',
        language: 'zh-CN',
        allowEmpty: true,
        item,
    };
}
