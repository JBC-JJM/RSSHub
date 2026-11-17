import { config } from '@/config';
import type { Route } from '@/types';
import cache from '@/utils/cache';

import { fetchRebangItems } from './utils';

const pageUrl = 'https://rebang.today/ent?tab=xiaoheihe';

export const route: Route = {
    path: '/xiaoheihe',
    categories: ['new-media'],
    example: '/rebang/xiaoheihe',
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
            source: ['rebang.today/ent?tab=xiaoheihe'],
            target: '/xiaoheihe',
        },
    ],
    name: '小黑盒热榜',
    maintainers: ['JBC-JJM'],
    handler,
    url: 'rebang.today',
    description: '小黑盒热榜，最多返回前 20 条；无榜单图片时使用小黑盒图标。',
};

async function handler() {
    const item = await cache.tryGet(
        'rebang:xiaoheihe',
        () =>
            fetchRebangItems({
                tab: 'xiaoheihe',
                subTab: 'hot-rank',
                pageUrl,
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
        config.cache.routeExpire,
        false
    );

    return {
        title: '今日热榜 - 小黑盒热榜',
        description: '今日热榜小黑盒榜单，最多收录前 20 条。',
        link: pageUrl,
        language: 'zh-CN' as const,
        item,
    };
}
