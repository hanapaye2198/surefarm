export function withoutDemoWordText(
    value: string | undefined,
): string | undefined {
    if (value === undefined) return undefined;

    return value
        .replace(/\bdemo(?:\s+data\s+only)?\b(?![\w.+-]*@)/gi, '')
        .replace(/\s+([,.;!?])/g, '$1')
        .replace(/^\s*[-\u2013\u2014|/]\s*/, '')
        .replace(/\s*[-\u2013\u2014|/]\s*$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}
