import { Link, router } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { dashboard } from '@/routes';
import type { RegistryFilters, RegistryPayload } from '@/types/admin-dashboard';

const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export function registryQuery(
    filters: RegistryFilters,
    patch: Partial<RegistryFilters> = {},
): Record<string, string | number> {
    const next = { ...filters, ...patch };
    const query: Record<string, string | number> = {};

    (Object.keys(next) as (keyof RegistryFilters)[]).forEach((key) => {
        const value = next[key];

        if (value === '' || value === null) {
            return;
        }

        if (key === 'per_page' && value === 10) {
            return;
        }

        if (key === 'layer' && value === 'locations') {
            return;
        }

        if (key === 'rank' && value === 'declared') {
            return;
        }

        if (key === 'trend' && value === '30') {
            return;
        }

        if (key === 'sort' && value === 'declared_area') {
            return;
        }

        if (key === 'direction' && value === 'desc') {
            return;
        }

        query[key] = value;
    });

    return query;
}

export function visitRegistry(
    filters: RegistryFilters,
    patch: Partial<RegistryFilters> = {},
): void {
    router.get(
        dashboard.url({ query: registryQuery(filters, patch) }),
        {},
        { preserveScroll: true, preserveState: true, replace: true },
    );
}

export function AdminRegistryFilters({
    registry,
}: {
    registry: RegistryPayload;
}) {
    const { filters, options } = registry;

    function apply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const province = String(form.get('province') ?? '');
        const municipality = String(form.get('municipality') ?? '');

        visitRegistry(filters, {
            search: String(form.get('search') ?? '').trim(),
            province,
            municipality: province === filters.province ? municipality : '',
            barangay:
                province === filters.province &&
                municipality === filters.municipality
                    ? String(form.get('barangay') ?? '')
                    : '',
            farmer: String(form.get('farmer') ?? ''),
            farm:
                String(form.get('farmer') ?? '') === filters.farmer
                    ? String(form.get('farm') ?? '')
                    : '',
            crop: String(form.get('crop') ?? ''),
            verification_status: String(form.get('verification_status') ?? ''),
            status: String(form.get('status') ?? ''),
            boundary: String(form.get('boundary') ?? ''),
            registered_from: String(form.get('registered_from') ?? ''),
            registered_to: String(form.get('registered_to') ?? ''),
            updated_from: String(form.get('updated_from') ?? ''),
            updated_to: String(form.get('updated_to') ?? ''),
            trend: String(form.get('trend') ?? '30'),
            trend_from: String(form.get('trend_from') ?? ''),
            trend_to: String(form.get('trend_to') ?? ''),
            rank: String(form.get('rank') ?? 'declared'),
        });
    }

    return (
            <form key={JSON.stringify(filters)} onSubmit={apply} className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground sm:col-span-2">
                    Search
                    <input
                        name="search"
                        defaultValue={filters.search}
                        placeholder="Farmer, farmer reference, farm, or farm reference"
                        aria-label="Search the registry"
                        className={selectClass}
                    />
                </label>
                <Field label="Province" name="province" value={filters.province} options={options.provinces} />
                <Field
                    label="Municipality"
                    name="municipality"
                    value={filters.municipality}
                    options={options.municipalities}
                />
                <Field label="Barangay" name="barangay" value={filters.barangay} options={options.barangays} />
                <Field label="Crop" name="crop" value={filters.crop} options={options.crops} />
                <Field
                    label="Verification"
                    name="verification_status"
                    value={filters.verification_status}
                    options={options.verification_statuses}
                />
                <Field label="Farm status" name="status" value={filters.status} options={options.statuses} />
                <Field label="Boundary" name="boundary" value={filters.boundary} options={options.boundaries} />
                <Field label="Registered farmer" name="farmer" value={filters.farmer} options={options.farmers} />
                <Field
                    label="Farm"
                    name="farm"
                    value={filters.farm}
                    options={options.farms}
                    emptyLabel={filters.farmer === '' ? 'Choose a farmer first' : 'All farms'}
                />
            </div>
            <details className="rounded-xl border bg-card px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">
                    Dates, ranking, and trend
                </summary>
                <div className="grid gap-2 pt-3 sm:grid-cols-2 xl:grid-cols-4">
                    <DateField label="Registered from" name="registered_from" value={filters.registered_from} />
                    <DateField label="Registered to" name="registered_to" value={filters.registered_to} />
                    <DateField label="Updated from" name="updated_from" value={filters.updated_from} />
                    <DateField label="Updated to" name="updated_to" value={filters.updated_to} />
                    <Field label="Owner ranking" name="rank" value={filters.rank} options={options.ranks} includeBlank={false} />
                    <Field label="Trend" name="trend" value={filters.trend} options={options.trends} includeBlank={false} />
                    <DateField label="Trend from" name="trend_from" value={filters.trend_from} />
                    <DateField label="Trend to" name="trend_to" value={filters.trend_to} />
                </div>
            </details>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                    Apply filters
                </button>
                <Link
                    href={dashboard.url()}
                    className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
                >
                    Reset
                </Link>
                {options.farmers_limited && (
                    <p className="text-xs text-muted-foreground">
                        The farmer list shows the first 100 matches. Search to narrow it.
                    </p>
                )}
            </div>
        </form>
    );
}

function Field({
    label,
    name,
    value,
    options,
    includeBlank = true,
    emptyLabel = 'All',
}: {
    label: string;
    name: string;
    value: string;
    options: { value: string; label: string; reference?: string }[];
    includeBlank?: boolean;
    emptyLabel?: string;
}) {
    return (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {label}
            <select name={name} defaultValue={value} aria-label={label} className={selectClass}>
                {includeBlank && <option value="">{emptyLabel}</option>}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.reference
                            ? `${option.label} (${option.reference})`
                            : option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function DateField({
    label,
    name,
    value,
}: {
    label: string;
    name: string;
    value: string;
}) {
    return (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {label}
            <input
                type="date"
                name={name}
                defaultValue={value}
                aria-label={label}
                className={selectClass}
            />
        </label>
    );
}
