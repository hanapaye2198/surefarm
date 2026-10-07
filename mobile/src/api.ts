export type ApiPage<T = Record<string, unknown>> = {
    component: string;
    data: T;
    flash?: Record<string, unknown>;
};

export class ApiError extends Error {
    status: number;
    fields: Record<string, string[]>;

    constructor(
        message: string,
        status: number,
        fields: Record<string, string[]> = {},
    ) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.fields = fields;
    }
}

const SITE_URL = (
    process.env.EXPO_PUBLIC_SUREFARM_URL ?? 'https://surefarm.io'
).replace(/\/$/, '');
const API_URL = `${SITE_URL}/api/mobile`;

export async function apiRequest<T>(
    path: string,
    token?: string | null,
    options: {
        method?: string;
        body?: Record<string, unknown> | FormData;
    } = {},
): Promise<T> {
    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Inertia': 'true',
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    let body: BodyInit | undefined;

    if (options.body instanceof FormData) {
        body = options.body;
    } else if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
    }

    let response: Response;

    try {
        response = await fetch(
            `${API_URL}${path.startsWith('/') ? path : `/${path}`}`,
            {
                method: options.method ?? 'GET',
                headers,
                body,
            },
        );
    } catch {
        throw new ApiError(
            'Could not connect. Check your internet connection and try again.',
            0,
        );
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const fields =
            payload?.errors && typeof payload.errors === 'object'
                ? (payload.errors as Record<string, string[]>)
                : {};
        const firstFieldError = Object.values(fields).flat()[0];
        const message =
            firstFieldError ??
            payload?.message ??
            'The request could not be completed.';
        throw new ApiError(message, response.status, fields);
    }

    return payload as T;
}

export { API_URL, SITE_URL };
