import type { Context } from 'hono';

import type { Data, Route } from '@/types';
import ofetch from '@/utils/ofetch';

// Proxies chiphell cover images so image proxies (e.g. feed reader thumbnail services) that
// chiphell's WAF rejects can still load them. Restricted to the cover-image host to avoid
// turning this route into an open proxy.
const allowedHosts = new Set(['static.chiphell.com']);

// Covers are content-addressed by their uploaded filename and never change, so they can be
// cached aggressively. This also keeps feed readers from re-fetching the same image repeatedly.
const CACHE_SECONDS = 60 * 60 * 24 * 7;

export const route: Route = {
    path: '/img',
    categories: ['bbs'],
    example: '/chiphell/img?url=https://static.chiphell.com/forum/202611/18/184712rx3fcsdgaa3oo4za.jpg',
    name: '封面图片代理',
    maintainers: ['tylinux'],
    handler,
};

async function handler(ctx: Context): Promise<Data | Response> {
    const raw = ctx.req.query('url');
    if (!raw) {
        return new Response('Missing required query parameter: url', { status: 400 });
    }

    let target: URL;
    try {
        target = new URL(raw);
    } catch {
        return new Response(`Invalid url: ${raw}`, { status: 400 });
    }
    if (target.protocol !== 'https:' || !allowedHosts.has(target.hostname)) {
        return new Response(`Host not allowed: ${target.hostname}. Allowed: ${[...allowedHosts].join(', ')}`, { status: 400 });
    }

    try {
        const response = await ofetch.raw<ArrayBuffer, 'arrayBuffer'>(target.href, {
            responseType: 'arrayBuffer',
            // A rejected request is a definitive answer, not a transient failure.
            retry: 0,
            headers: {
                referer: 'https://www.chiphell.com/',
            },
        });
        // Covers are often PNG screenshots; serving those as image/jpeg makes strict clients
        // (including feed reader thumbnail services) fail to decode them.
        const contentType = normalizeImageType(response.headers.get('content-type')) ?? typeFromPath(target.pathname);
        return new Response(response._data as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch {
        // Do not forward the upstream status: a 567 would tell readers to cache the failure.
        return new Response('Failed to fetch image', { status: 502 });
    }
}

/** Keeps only image content types, so an HTML block page never gets served as an image. */
function normalizeImageType(header: string | null) {
    if (!header) {
        return undefined;
    }
    const mime = header.split(';')[0].trim().toLowerCase();
    return mime.startsWith('image/') ? mime : undefined;
}

function typeFromPath(pathname: string) {
    const extension = pathname.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'png':
            return 'image/png';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        default:
            return 'image/jpeg';
    }
}
