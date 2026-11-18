import type { Context } from 'hono';

import type { Data, DataItem, Route } from '@/types';
import { config } from '@/config';
import ofetch from '@/utils/ofetch';

// Temporary connectivity probe: reports whether this deployment's egress can fetch chiphell
// assets. Delete the route once the question is answered.
const allowedHosts = new Set(['static.chiphell.com', 'www.chiphell.com']);

const JPEG_MAGIC = [0xff, 0xd8];

export const route: Route = {
    path: '/img',
    categories: ['bbs'],
    example: '/chiphell/img',
    name: '封面代理连通性验证（临时）',
    maintainers: ['tylinux'],
    handler,
};

type ProbeReport = {
    ok: boolean;
    status: number | null;
    bytes: number | null;
    isJpeg: boolean;
    /** A 200 that is not an image usually means EdgeOne served a JS challenge instead. */
    challengeSuspected: boolean;
    /** 567 is EdgeOne's WAF block code (custom rules / rate limit / bot management). */
    blockedByWaf: boolean;
    elapsedMs: number;
    /**
     * When true, requests carry randomly generated full browser headers (header-generator),
     * not `configuredUa` — that fallback UA is only used when this is false.
     */
    usesRandomBrowserHeaders: boolean;
    configuredUa: string;
    message?: string;
    bodyPreview?: string;
};

async function handler(ctx: Context): Promise<Data> {
    // Bypass the route cache so every probe is a live fetch.
    ctx.header('Cache-Control', 'no-cache');

    const raw = ctx.req.query('url');
    if (!raw) {
        throw new Error('Missing required query parameter: url');
    }

    let target: URL;
    try {
        target = new URL(raw);
    } catch {
        throw new Error(`Invalid url: ${raw}`);
    }
    if (!allowedHosts.has(target.hostname)) {
        throw new Error(`Host not allowed: ${target.hostname}. Allowed: ${[...allowedHosts].join(', ')}`);
    }

    const report = await probe(target);

    const item: DataItem = {
        title: `status=${report.status} bytes=${report.bytes ?? 'null'} ok=${report.ok}`,
        link: target.href,
        description: JSON.stringify(report, null, 2),
    };

    return {
        title: 'chiphell 封面代理连通性验证',
        link: target.href,
        item: [item],
    };
}

async function probe(target: URL): Promise<ProbeReport> {
    const startedAt = Date.now();
    const base = {
        elapsedMs: 0,
        usesRandomBrowserHeaders: config.isDefaultUA,
        configuredUa: config.ua,
    };

    try {
        const body = await ofetch<ArrayBuffer, 'arrayBuffer'>(target.href, {
            responseType: 'arrayBuffer',
            // A blocked probe is a definitive answer, not a transient failure; retrying just delays it.
            retry: 0,
            headers: {
                referer: 'https://www.chiphell.com/',
            },
        });
        const buffer = Buffer.from(body);
        const isJpeg = buffer.length > 4 && JPEG_MAGIC.every((byte, index) => buffer[index] === byte);
        return {
            ...base,
            ok: true,
            status: 200,
            bytes: buffer.byteLength,
            isJpeg,
            challengeSuspected: !isJpeg,
            blockedByWaf: false,
            elapsedMs: Date.now() - startedAt,
        };
    } catch (error: unknown) {
        const response = getResponse(error);
        const status = response?.status ?? null;
        return {
            ...base,
            ok: false,
            status,
            bytes: null,
            isJpeg: false,
            challengeSuspected: false,
            blockedByWaf: status === 567,
            elapsedMs: Date.now() - startedAt,
            message: error instanceof Error ? error.message : String(error),
            bodyPreview: previewOf(response?._data),
        };
    }
}

function getResponse(error: unknown): { status?: number; statusText?: string; _data?: unknown } | undefined {
    if (typeof error === 'object' && error !== null && 'response' in error) {
        const response = (error as { response?: unknown }).response;
        if (typeof response === 'object' && response !== null) {
            return response as { status?: number; statusText?: string; _data?: unknown };
        }
    }
    return undefined;
}

function previewOf(data: unknown): string {
    if (typeof data === 'string') {
        return data.slice(0, 200);
    }
    if (data === undefined || data === null) {
        return '';
    }
    try {
        return JSON.stringify(data).slice(0, 200);
    } catch {
        return '';
    }
}
