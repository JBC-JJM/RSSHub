import { config } from '@/config';
import type { Data, Route } from '@/types';
import cache from '@/utils/cache';

import { fetchRebangItems } from './utils';

const pageUrl = 'https://rebang.today/home?tab=douban-media';

const subTabs = {
    movie: '豆瓣电影',
    tv: '豆瓣剧集',
    book: '豆瓣图书',
    music: '豆瓣音乐',
} as const;

type SubTab = keyof typeof subTabs;

const isSubTab = (value: string): value is SubTab => Object.hasOwn(subTabs, value);

export const route: Route = {
    path: '/douban/:subTab?',
    categories: ['new-media'],
    example: '/rebang/douban',
    parameters: {
        subTab: '榜单类型，可选 `movie`（电影，默认）、`tv`（剧集）、`book`（图书）、`music`（音乐）',
    },
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
            source: ['rebang.today/home?tab=douban-media'],
            target: '/douban',
        },
    ],
    name: '豆瓣榜单',
    maintainers: ['JBC-JJM'],
    handler,
    url: 'rebang.today',
    description: '今日热榜的豆瓣榜单，含电影、剧集、图书、音乐四类，电影与剧集各 10 条，图书与音乐各 20 条；条目附带评分、类型、导演/作者等信息。',
};

async function handler(ctx): Promise<Data> {
    const requested = ctx.req.param('subTab') ?? 'movie';
    if (!isSubTab(requested)) {
        throw new Error(`未知的豆瓣榜单类型 "${requested}"，可选：${Object.keys(subTabs).join('、')}`);
    }
    const subTab = requested;
    const name = subTabs[subTab];

    const item = await cache.tryGet(
        `rebang:douban:${subTab}`,
        () =>
            fetchRebangItems({
                tab: 'douban-media',
                subTab,
                pageUrl,
                maxItems: 20,
                maxPages: 2,
                pageSize: 20,
                category: '豆瓣榜单',
                includeExtraInfo: true,
                defaultSource: {
                    tab_key: 'douban',
                    name: '豆瓣',
                    avatar: 'forever/tab_icon/douban.png',
                },
            }),
        config.cache.routeExpire,
        false
    );

    return {
        title: `今日热榜 - ${name}`,
        description: `今日热榜${name}，按榜单顺序收录，条目附带评分与类型信息。`,
        link: pageUrl,
        language: 'zh-CN' as const,
        item,
    };
}
