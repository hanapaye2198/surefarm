import { Head, Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { StatusBadge, TraceabilityStatusBadge } from '@/components/status-badge';
import type { FarmStatus, TraceabilityRecordStatus } from '@/components/status-badge';
import { TraceabilityOriginMap } from '@/components/traceability-origin-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { show as showFarm } from '@/routes/farms';
import { show as showFarmer } from '@/routes/farmers';
import { index, print } from '@/routes/traceability';

type JourneyStep = {
    date: string | null;
    from_stage: string | null;
    input_label: string;
    to_stage: string | null;
    output_label: string | null;
};

type TimelineItem = {
    title: string;
    date: string | null;
    detail: string;
};

type LotDetail = {
    id: number;
    lot_code: string;
    quantity_label: string;
    status: TraceabilityRecordStatus;
    status_label: string;
    notes: string | null;
    crop: string | null;
    stage: string | null;
    farmer: { id: number; farmer_id: string; full_name: string } | null;
    farm: {
        id: number;
        farm_id: string;
        farm_name: string;
        location: string;
        declared_area: string;
        verified_area: string;
        variance: string;
        verification_status: FarmStatus;
        verification_label: string;
        latitude: number | null;
        longitude: number | null;
        has_location: boolean;
        boundary: { type: string; coordinates: [number, number][][] } | null;
    } | null;
    harvest: {
        label: string;
        harvest_date_long: string | null;
        quantity_label: string;
        status_label: string;
    } | null;
};

type Receipt = {
    date: string | null;
    quantity_label: string;
    stage: string | null;
} | null;

export function TraceabilitySheet({
    lot,
    journey,
    receipt,
    timeline,
    qr_svg,
    public_url,
    stages,
    printable = false,
}: {
    lot: LotDetail;
    journey: JourneyStep[];
    receipt: Receipt;
    timeline: TimelineItem[];
    qr_svg: string;
    public_url: string;
    stages: string[];
    printable?: boolean;
}) {
    function downloadQr() {
        const blob = new Blob([qr_svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${lot.lot_code}.svg`;
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-4">
                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Origin</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <dl className="grid gap-4 sm:grid-cols-2">
                            <Field label="Farmer" value={lot.farmer ? <Link href={showFarmer(lot.farmer.id)} className="hover:underline">{lot.farmer.full_name}</Link> : '—'} />
                            <Field label="Farmer ID" value={lot.farmer?.farmer_id ?? '—'} />
                            <Field label="Farm" value={lot.farm ? <Link href={showFarm(lot.farm.id)} className="hover:underline">{lot.farm.farm_name}</Link> : '—'} />
                            <Field label="Farm ID" value={lot.farm?.farm_id ?? '—'} />
                            <Field label="Location" value={lot.farm?.location || '—'} />
                            <Field label="Crop" value={lot.crop ?? '—'} />
                            <Field label="Declared area" value={lot.farm?.declared_area ?? '—'} />
                            <Field label="Verified area" value={lot.farm?.verified_area ?? '—'} />
                            <Field label="Variance" value={lot.farm?.variance ?? '—'} />
                            <div>
                                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Farm verification</dt>
                                <dd className="mt-1">{lot.farm ? <StatusBadge status={lot.farm.verification_status} /> : '—'}</dd>
                            </div>
                        </dl>
                        {!printable && (
                            lot.farm?.has_location ? (
                                <TraceabilityOriginMap latitude={lot.farm.latitude} longitude={lot.farm.longitude} boundary={lot.farm.boundary} />
                            ) : (
                                <p className="text-sm text-muted-foreground">Farm location not available.</p>
                            )
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Harvest</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {lot.harvest ? (
                            <dl className="grid gap-4 sm:grid-cols-3">
                                <Field label="Harvest date" value={lot.harvest.harvest_date_long ?? '—'} />
                                <Field label="Harvest quantity" value={lot.harvest.quantity_label} />
                                <Field label="Harvest status" value={lot.harvest.status_label} />
                            </dl>
                        ) : (
                            <p className="text-sm text-muted-foreground">No harvest is linked to this lot.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Processing journey</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            {stages.map((stage, index) => (
                                <li key={stage} className="flex items-center gap-3">
                                    <span className={`rounded-full px-3 py-1 text-sm ${lot.stage === stage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{stage}</span>
                                    {index < stages.length - 1 && <span className="hidden text-muted-foreground sm:inline">↓</span>}
                                </li>
                            ))}
                        </ol>
                        {receipt && (
                            <p className="text-sm">
                                <span className="text-muted-foreground">{receipt.date}</span>
                                {' · Harvest received '}
                                <span className="font-medium tabular-nums">{receipt.quantity_label}</span>
                                {receipt.stage ? ` ${receipt.stage}` : ''}
                            </p>
                        )}
                        {journey.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No processing history available.</p>
                        ) : (
                            <ol className="grid gap-3">
                                {journey.map((step) => (
                                    <li key={`${step.date}-${step.from_stage}-${step.to_stage}`} className="rounded-lg border px-4 py-3 text-sm">
                                        <p className="text-muted-foreground">{step.date}</p>
                                        <p className="font-medium">{step.from_stage} → {step.to_stage}</p>
                                        <p className="tabular-nums">{step.input_label} → {step.output_label}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>

                {!printable && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Timeline</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ol className="grid gap-4 border-l pl-4">
                                {timeline.map((item) => (
                                    <li key={`${item.title}-${item.date}`} className="relative">
                                        <span className="absolute top-1.5 -left-[1.3rem] size-2.5 rounded-full bg-primary" />
                                        <p className="text-xs text-muted-foreground">{item.date ?? '—'}</p>
                                        <p className="font-medium">{item.title}</p>
                                        <p className="text-sm text-muted-foreground">{item.detail}</p>
                                    </li>
                                ))}
                            </ol>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Card className="h-fit shadow-none">
                <CardHeader>
                    <CardTitle>QR code</CardTitle>
                </CardHeader>
                <CardContent className="grid justify-items-center gap-3 text-center">
                    <div className="w-48" dangerouslySetInnerHTML={{ __html: qr_svg }} />
                    <p className="font-medium tracking-wide">{lot.lot_code}</p>
                    <p className="text-sm text-muted-foreground">Scan to view coffee traceability</p>
                    <p className="break-all text-xs text-muted-foreground">{public_url}</p>
                    <Button type="button" variant="outline" onClick={downloadQr}>Download QR</Button>
                </CardContent>
            </Card>
        </div>
    );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-1 text-sm">{value}</dd>
        </div>
    );
}

export default function TraceabilityShow({
    lot,
    journey,
    receipt,
    timeline,
    qr_svg,
    public_url,
    stages,
}: {
    lot: LotDetail;
    journey: JourneyStep[];
    receipt: Receipt;
    timeline: TimelineItem[];
    qr_svg: string;
    public_url: string;
    stages: string[];
}) {
    return (
        <>
            <Head title={`Coffee Lot ${lot.lot_code}`} />
            <div className="flex flex-col gap-6">
                <PageHeader
                    title={`Coffee Lot ${lot.lot_code}`}
                    description={`${lot.quantity_label} ${lot.stage ?? ''}`.trim()}
                    actions={
                        <>
                            <TraceabilityStatusBadge status={lot.status} />
                            <Button variant="outline" asChild>
                                <Link href={print(lot.id)}>Print</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link href={index()}>Back to traceability</Link>
                            </Button>
                        </>
                    }
                />
                <TraceabilitySheet lot={lot} journey={journey} receipt={receipt} timeline={timeline} qr_svg={qr_svg} public_url={public_url} stages={stages} />
            </div>
        </>
    );
}
