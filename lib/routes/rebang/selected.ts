import type { Route } from '@/types';
import cache from '@/utils/cache';

import { fetchRebangItems, REBANG_CACHE_SECONDS, sortByPublishedAt } from './utils';

const tiebaPageUrl = 'https://rebang.today/?tab=baidu-tieba';
const xiaoheihePageUrl = 'https://rebang.today/ent?tab=xiaoheihe';
const doubanPageUrl = 'https://rebang.today/home?tab=douban-media';
const gamerskyPageUrl = 'https://rebang.today/home?tab=gamersky';

export const route: Route = {
    path: '/selected',
    categories: ['new-media'],
    example: '/rebang/selected',
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
            source: ['rebang.today/?tab=baidu-tieba'],
            target: '/selected',
        },
        {
            source: ['rebang.today/ent?tab=xiaoheihe'],
            target: '/selected',
        },
        {
            source: ['rebang.today/home?tab=douban-media'],
            target: '/selected',
        },
        {
            source: ['rebang.today/home?tab=gamersky'],
            target: '/selected',
        },
    ],
    name: '自选热榜',
    maintainers: ['JBC-JJM'],
    handler,
    url: 'rebang.today',
    description: '合并贴吧（30 条）、小黑盒（20 条）、豆瓣电影（10 条）与游民星空（50 条）四个榜单，最多 110 条。有发布时间的按时间倒序排列；贴吧与豆瓣只有排名、没有发布时间，按榜单顺序排在最后。',
};

async function handler() {
    const item = await cache.tryGet(
        'rebang:selected',
        async () => {
            const [tiebaItems, xiaoheiheItems, doubanItems, gamerskyItems] = await Promise.all([
                fetchRebangItems({
                    tab: 'baidu-tieba',
                    subTab: 'topic',
                    pageUrl: tiebaPageUrl,
                    maxItems: 30,
                    maxPages: 1,
                    pageSize: 30,
                    category: '贴吧热榜',
                    defaultSource: {
                        tab_key: 'baidu-tieba',
                        name: '贴吧',
                        avatar: 'forever/tab_icon/baidu-tieba.png',
                    },
                }),
                fetchRebangItems({
                    tab: 'xiaoheihe',
                    subTab: 'hot-rank',
                    pageUrl: xiaoheihePageUrl,
                    maxItems: 20,
                    maxPages: 5,
                    pageSize: 20,
                    category: '小黑盒热榜',
                    defaultSource: {
                        tab_key: 'xiaoheihe',
                        name: '小黑盒',
                        avatar: 'forever/tab_icon/xiaoheihe.png',
                    },
                }),
                fetchRebangItems({
                    tab: 'douban-media',
                    subTab: 'movie',
                    pageUrl: doubanPageUrl,
                    maxItems: 10,
                    maxPages: 1,
                    pageSize: 20,
                    category: '豆瓣榜单',
                    includeExtraInfo: true,
                    defaultSource: {
                        tab_key: 'douban',
                        name: '豆瓣',
                        avatar: 'forever/tab_icon/douban.png',
                    },
                }),
                fetchRebangItems({
                    tab: 'gamersky',
                    subTab: 'rec',
                    pageUrl: gamerskyPageUrl,
                    maxItems: 50,
                    maxPages: 1,
                    pageSize: 50,
                    category: '游民星空',
                    defaultSource: {
                        tab_key: 'gamersky',
                        name: '游民星空',
                        avatar: 'forever/tab_icon/gamersky.png',
                    },
                }),
            ]);

            return sortByPublishedAt([...xiaoheiheItems, ...gamerskyItems, ...tiebaItems, ...doubanItems]);
        },
        REBANG_CACHE_SECONDS,
        false
    );

    return {
        title: '今日热榜 - 自选',
        description: '贴吧、小黑盒、豆瓣电影与游民星空热榜合并订阅，最多 110 条。',
        link: 'https://rebang.today/',
        language: 'zh-CN' as const,
        item,
    };
}
