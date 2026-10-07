import { Head, Link, setLayoutProps, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { FarmBoundaryMap } from '@/components/farm-boundary-map';
import type { BoundaryGeoJson } from '@/components/farm-boundary-map';
import { FarmVerificationHistory } from '@/components/farm-verification-history';
import type { VerificationHistoryRow } from '@/components/farm-verification-history';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { FarmerStatusBadge, StatusBadge } from '@/components/status-badge';
import type { FarmStatus, FarmerRecordStatus } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { index, show, store, update } from '@/routes/farm-verification';
import { show as showFarm } from '@/routes/farms';

type VerificationFarm = {
    id: number;
    farm_id: string;
    farm_name: string;
    farmer_name: string;
    farmer_id: string;
    crop_label: string;
    location: string;
    farm_status: FarmerRecordStatus;
    verification_status: FarmStatus;
    verified_area: string;
    declared_area_hectares: number;
    latitude: string | null;
    longitude: string | null;
};

type Decision = 'verified' | 'failed' | 'needs_review';

const decisionCopy: Record<
    Decision,
    { title: string; description: string; confirm: string; variant: 'default' | 'destructive' | 'secondary' }
> = {
    verified: {
        title: 'Approve verification?',
        description:
            'Verified area will be set to the measured area from the saved boundary. Declared area stays unchanged.',
        confirm: 'Approve Verification',
        variant: 'default',
    },
    failed: {
        title: 'Mark verification as failed?',
        description:
            'The farm will be marked failed. Declared area and any existing verified area stay unchanged.',
        confirm: 'Mark as Failed',
        variant: 'destructive',
    },
    needs_review: {
        title: 'Mark as needs review?',
        description:
            'The farm will stay open for another look. Declared area and any existing verified area stay unchanged.',
        confirm: 'Needs Review',
        variant: 'secondary',
    },
};

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd className="text-sm">{value}</dd>
        </div>
    );
}

export default function FarmVerificationShow({
    farm,
    comparison,
    boundary,
    history,
}: {
    farm: VerificationFarm;
    comparison: {
        declared_area: string;
        measured_area: string;
        difference: string;
        variance: string;
        has_boundary: boolean;
    };
    boundary: {
        geojson: BoundaryGeoJson;
        gps_measured_area_hectares: number;
        captured_by: string | null;
        captured_at: string | null;
        updated_by: string | null;
        updated_at: string | null;
    } | null;
    history: VerificationHistoryRow[];
}) {
    const [decision, setDecision] = useState<Decision | null>(null);
    const startForm = useForm({ verification: '' });
    const reviewForm = useForm({
        result: '' as Decision | '',
        remarks: '',
        verification: '',
    });
    const inProgress = farm.verification_status === 'in_progress';
    const pendingDecision = decision === null ? null : decisionCopy[decision];

    setLayoutProps({
        breadcrumbs: [
            {
                title: 'Farm Verification',
                href: index(),
            },
            {
                title: farm.farm_name,
                href: show(farm.id),
            },
        ],
    });

    function startVerification() {
        startForm.post(store.url(farm.id), { preserveScroll: true });
    }

    function saveDecision() {
        if (decision === null) {
            return;
        }

        reviewForm.transform((data) => ({
            ...data,
            result: decision,
        }));
        reviewForm.put(update.url(farm.id), {
            preserveScroll: true,
            onSuccess: () => setDecision(null),
        });
    }

    return (
        <>
            <Head title={`${farm.farm_name} verification`} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={farm.farm_name}
                    description={`${farm.farm_id} · ${farm.farmer_name}`}
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={index()}>Back to verification</Link>
                        </Button>
                    }
                />

                <Card className="shadow-none">
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={farm.verification_status} />
                            <FarmerStatusBadge status={farm.farm_status} />
                        </div>
                        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Detail label="Farm ID" value={farm.farm_id} />
                            <Detail label="Farm Name" value={farm.farm_name} />
                            <Detail label="Farmer" value={farm.farmer_name} />
                            <Detail label="Farmer ID" value={farm.farmer_id} />
                            <Detail label="Crop" value={farm.crop_label} />
                            <Detail label="Location" value={farm.location} />
                        </dl>
                    </CardContent>
                </Card>

                <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
                    <StatCard
                        label="Declared Area"
                        value={comparison.declared_area}
                    />
                    <StatCard
                        label="Measured Area"
                        value={comparison.measured_area}
                    />
                    <StatCard label="Verified Area" value={farm.verified_area} />
                    <StatCard label="Difference" value={comparison.difference} />
                    <StatCard label="Variance" value={comparison.variance} />
                </section>

                {!comparison.has_boundary && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Boundary required</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">
                                Farm boundary is required before verification.
                            </p>
                            <Button className="w-fit" asChild>
                                <Link
                                    href={showFarm.url(farm.id, {
                                        query: { tab: 'map' },
                                    })}
                                >
                                    View Farm Map
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {comparison.has_boundary && boundary && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Farm boundary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FarmBoundaryMap
                                inspection
                                active
                                farm={{
                                    id: farm.id,
                                    farm_name: farm.farm_name,
                                    declared_area_hectares:
                                        farm.declared_area_hectares,
                                    verification_status:
                                        farm.verification_status,
                                    latitude: farm.latitude,
                                    longitude: farm.longitude,
                                    farmer_name: farm.farmer_name,
                                    can_manage_boundary: false,
                                    can_remove_boundary: false,
                                }}
                                boundary={boundary}
                            />
                        </CardContent>
                    </Card>
                )}

                {comparison.has_boundary && !inProgress && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>
                                {farm.verification_status === 'pending'
                                    ? 'Start verification'
                                    : 'Verify again'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">
                                Starting copies the current declared area and
                                the measured area from the saved boundary. It
                                does not change the declared area.
                            </p>
                            {startForm.errors.verification && (
                                <p className="text-sm text-destructive">
                                    {startForm.errors.verification}
                                </p>
                            )}
                            <Button
                                className="w-fit"
                                disabled={startForm.processing}
                                onClick={startVerification}
                            >
                                Start Verification
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {comparison.has_boundary && inProgress && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Verification review</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <label className="grid gap-2 text-sm">
                                <span className="font-medium">
                                    Verification Remarks
                                </span>
                                <textarea
                                    value={reviewForm.data.remarks}
                                    onChange={(event) =>
                                        reviewForm.setData(
                                            'remarks',
                                            event.target.value,
                                        )
                                    }
                                    rows={4}
                                    className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    placeholder="Notes for this review"
                                />
                            </label>
                            {reviewForm.errors.remarks && (
                                <p className="text-sm text-destructive">
                                    {reviewForm.errors.remarks}
                                </p>
                            )}
                            {reviewForm.errors.verification && (
                                <p className="text-sm text-destructive">
                                    {reviewForm.errors.verification}
                                </p>
                            )}
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button onClick={() => setDecision('verified')}>
                                    Approve Verification
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => setDecision('failed')}
                                >
                                    Mark as Failed
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setDecision('needs_review')}
                                >
                                    Needs Review
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Verification history</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {history.length === 0 ? (
                            <EmptyState
                                title="No verification records yet."
                                description="A record is created when verification starts."
                            />
                        ) : (
                            <FarmVerificationHistory rows={history} />
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog
                open={decision !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDecision(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{pendingDecision?.title}</DialogTitle>
                        <DialogDescription>
                            {pendingDecision?.description}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDecision(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant={pendingDecision?.variant ?? 'default'}
                            disabled={reviewForm.processing}
                            onClick={saveDecision}
                        >
                            {pendingDecision?.confirm}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

FarmVerificationShow.layout = {
    breadcrumbs: [
        {
            title: 'Farm Verification',
            href: index(),
        },
    ],
};
