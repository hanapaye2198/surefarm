import { Head } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { TraceabilitySheet } from '@/pages/traceability/show';

export default function TraceabilityPrint(
    props: ComponentProps<typeof TraceabilitySheet>,
) {
    return (
        <>
            <Head title={`Print ${props.lot.lot_code}`} />
            <main className="mx-auto min-h-screen max-w-4xl bg-white px-6 py-8 text-stone-900 print:px-0">
                <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
                    <div>
                        <p className="text-sm font-medium tracking-[0.2em] text-stone-500 uppercase">
                            SureFarm
                        </p>
                        <h1 className="mt-1 text-3xl font-semibold">
                            Coffee Traceability
                        </h1>
                    </div>
                    <Button type="button" onClick={() => window.print()}>
                        Print
                    </Button>
                </div>
                <p className="hidden text-sm font-medium tracking-[0.2em] text-stone-500 uppercase print:block">
                    SureFarm
                </p>
                <h1 className="mt-1 hidden text-3xl font-semibold print:block">
                    Coffee Traceability
                </h1>
                <p className="mt-2 text-lg">{props.lot.lot_code}</p>
                <p className="text-sm text-stone-600">
                    {props.lot.quantity_label} · {props.lot.stage} ·{' '}
                    {props.lot.status_label}
                </p>
                <div className="mt-6">
                    <TraceabilitySheet {...props} printable />
                </div>
            </main>
        </>
    );
}
