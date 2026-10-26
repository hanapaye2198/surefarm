export function formString(
    formData: FormData,
    key: string,
    fallback = '',
): string {
    const value = formData.get(key);

    return typeof value === 'string' ? value : fallback;
}
