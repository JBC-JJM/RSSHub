import { config } from '@/config';
import type { Data, Route } from '@/types';
import cache from '@/utils/cache';

import { fetchRebangItems } from './utils';

const pageUrl = 'https://rebang.today/home?tab=gamersky';

export const route: Route = {
    path: '/gamersky',
    categories: ['new-media'],
    example: '/rebang/gamersky',
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
            source: ['rebang.today/home?tab=gamersky'],
            target: '/gamersky',
        },
    ],
    name: '游民星空',
    maintainers: ['JBC-JJM'],
    handler,
    url: 'rebang.today',
    description: '今日热榜的游民星空榜单（推荐流，涵盖单机电玩、NS、手游、网游、业界、硬件、科技），最多返回 50 条；无榜单图片时使用游民星空图标。',
};

async function handler(): Promise<Data> {
    const item = await cache.tryGet(
        'rebang:gamersky',
        () =>
            fetchRebangItems({
                tab: 'gamersky',
                subTab: 'rec',
                pageUrl,
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
        config.cache.routeExpire,
        false
    );

    return {
        title: '今日热榜 - 游民星空',
        description: '今日热榜游民星空榜单，覆盖单机电玩、NS、手游、网游、业界、硬件、科技，最多收录前 50 条。',
        link: pageUrl,
        language: 'zh-CN' as const,
        item,
    };
}
