import { Head } from '@inertiajs/react';
import { StatusBadge } from '@/components/status-badge';
import type { FarmStatus } from '@/components/status-badge';

type JourneyStep = {
    date: string | null;
    from_stage: string | null;
    input_label: string;
    to_stage: string | null;
    output_label: string | null;
};

type PublicRecord = {
    lot_code: string;
    crop: string | null;
    farm_name: string | null;
    municipality: string | null;
    province: string | null;
    harvest_date: string | null;
    quantity_label: string;
    stage: string | null;
    verification_status: FarmStatus | null;
    verification_label: string | null;
    receipt: {
        date: string | null;
        quantity_label: string;
        stage: string | null;
    } | null;
    journey: JourneyStep[];
};

function place(record: PublicRecord): string {
    return (
        [record.municipality, record.province].filter(Boolean).join(', ') ||
        'Location not published'
    );
}

export default function PublicTraceability({
    record,
}: {
    record: PublicRecord | null;
}) {
    return (
        <>
            <Head
                title={
                    record
                        ? `Coffee ${record.lot_code}`
                        : 'Traceability record not found'
                }
            />
            <main className="min-h-screen bg-[oklch(0.97_0.02_95)] text-stone-900">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
                    <header className="grid gap-2">
                        <p className="text-sm font-semibold tracking-[0.22em] text-[oklch(0.4_0.08_150)] uppercase">
                            SureFarm
                        </p>
                        <h1 className="text-4xl font-semibold tracking-tight">
                            Coffee Traceability
                        </h1>
                        <p className="max-w-xl text-stone-600">
                            Follow this coffee from the farm through harvest and
                            processing.
                        </p>
                    </header>

                    {record === null ? (
                        <section className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
                            <h2 className="text-xl font-semibold">
                                Traceability record not found.
                            </h2>
                            <p className="mt-2 text-sm text-stone-600">
                                Check the lot code and scan the QR code again.
                            </p>
                        </section>
                    ) : (
                        <>
                            <section className="rounded-2xl bg-[oklch(0.38_0.07_150)] p-6 text-white shadow-sm">
                                <p className="text-sm tracking-wide text-white/80">
                                    Lot
                                </p>
                                <p className="mt-1 text-3xl font-semibold tracking-tight">
                                    {record.lot_code}
                                </p>
                                <p className="mt-3 text-lg">
                                    {record.quantity_label}
                                    {record.stage ? ` · ${record.stage}` : ''}
                                </p>
                            </section>

                            <section className="grid gap-4 sm:grid-cols-2">
                                <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
                                        Origin
                                    </h2>
                                    <p className="mt-2 text-lg font-semibold">
                                        {record.farm_name ?? 'Farm'}
                                    </p>
                                    <p className="text-sm text-stone-600">
                                        {place(record)}
                                    </p>
                                    <p className="mt-3 text-sm">
                                        {record.crop ?? 'Coffee'}
                                    </p>
                                </article>
                                <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
                                        Verification
                                    </h2>
                                    <div className="mt-3">
                                        {record.verification_status ? (
                                            <StatusBadge
                                                status={
                                                    record.verification_status
                                                }
                                            />
                                        ) : (
                                            <p className="text-sm text-stone-600">
                                                Not recorded
                                            </p>
                                        )}
                                    </div>
                                </article>
                                <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
                                        Harvest
                                    </h2>
                                    <p className="mt-2 text-lg font-semibold">
                                        {record.harvest_date ??
                                            'Harvest date not recorded'}
                                    </p>
                                </article>
                                <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                    <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
                                        Current stage
                                    </h2>
                                    <p className="mt-2 text-lg font-semibold">
                                        {record.stage ?? '—'}
                                    </p>
                                    <p className="text-sm text-stone-600">
                                        {record.quantity_label}
                                    </p>
                                </article>
                            </section>

                            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                                <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
                                    Processing journey
                                </h2>
                                {record.receipt && (
                                    <p className="mt-4 text-sm">
                                        {record.receipt.date} · Harvest received{' '}
                                        {record.receipt.quantity_label}
                                        {record.receipt.stage
                                            ? ` ${record.receipt.stage}`
                                            : ''}
                                    </p>
                                )}
                                {record.journey.length === 0 ? (
                                    <p className="mt-4 text-sm text-stone-600">
                                        No processing history available.
                                    </p>
                                ) : (
                                    <ol className="mt-4 grid gap-3">
                                        {record.journey.map((step) => (
                                            <li
                                                key={`${step.date}-${step.from_stage}-${step.to_stage}`}
                                                className="border-l-2 border-[oklch(0.4_0.08_150)] pl-4"
                                            >
                                                <p className="text-xs text-stone-500">
                                                    {step.date}
                                                </p>
                                                <p className="font-medium">
                                                    {step.from_stage} →{' '}
                                                    {step.to_stage}
                                                </p>
                                                <p className="text-sm text-stone-700 tabular-nums">
                                                    {step.input_label} →{' '}
                                                    {step.output_label}
                                                </p>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </section>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
