import type { Route } from '@/types';
import cache from '@/utils/cache';
import { fetchRebangItems, REBANG_CACHE_SECONDS } from './utils';

const pageUrl = 'https://rebang.today/home?tab=top';

export const route: Route = {
    path: '/top',
    categories: ['new-media'],
    example: '/rebang/top',
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
            source: ['rebang.today/home?tab=top'],
            target: '/top',
        },
    ],
    name: '全站综合热榜',
    maintainers: ['JBC-JJM'],
    handler,
    url: 'rebang.today',
    description: '全站综合热榜，最多返回前 100 条；无榜单图片时使用来源应用图标。',
};

async function handler() {
    const item = await cache.tryGet(
        'rebang:top',
        () =>
            fetchRebangItems({
                tab: 'top',
                subTab: 'today',
                pageUrl,
                maxItems: 100,
                maxPages: 3,
                pageSize: 50,
                pageDelayMs: 1000,
                category: '全站热榜',
            }),
        REBANG_CACHE_SECONDS,
        false
    );

    return {
        title: '今日热榜 - 全站综合热榜',
        description: '今日热榜全站综合榜单，最多收录前 100 条。',
        link: pageUrl,
        language: 'zh-CN' as const,
        item,
    };
}
