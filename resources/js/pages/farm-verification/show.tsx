import { Head, Link, setLayoutProps, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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
import {
    index,
    inspection as inspectionRoute,
    show,
    store,
    update,
} from '@/routes/farm-verification';

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
type InspectionCheck =
    | 'farm_exists'
    | 'location_matches'
    | 'crop_observed'
    | 'boundary_captured'
    | 'area_checked'
    | 'farmer_or_representative_met';

const inspectionChecks: { key: InspectionCheck; label: string }[] = [
    { key: 'farm_exists', label: 'Farm physically exists' },
    { key: 'location_matches', label: 'Location matches registration' },
    { key: 'crop_observed', label: 'Registered crop observed' },
    { key: 'boundary_captured', label: 'GPS boundary captured' },
    { key: 'area_checked', label: 'Declared and measured area checked' },
    {
        key: 'farmer_or_representative_met',
        label: 'Farmer or representative met',
    },
];

type InspectionPhoto = {
    id: number;
    type: string;
    name: string;
    url: string;
    captured_at: string | null;
    uploaded_at: string | null;
    latitude: number | null;
    longitude: number | null;
    uploaded_by: string | null;
    boundary_revision: number;
};

const decisionCopy: Record<
    Decision,
    {
        title: string;
        description: string;
        confirm: string;
        variant: 'default' | 'destructive' | 'secondary';
    }
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
    inspection,
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
        capture_method: string | null;
        captured_by: string | null;
        captured_at: string | null;
        updated_by: string | null;
        updated_at: string | null;
        can_manage_boundary: boolean;
    } | null;
    history: VerificationHistoryRow[];
    inspection: {
        checklist: Record<string, unknown>;
        boundary_revision: number;
        boundary_captured_for_attempt: boolean;
        photos: InspectionPhoto[];
    } | null;
}) {
    const [decision, setDecision] = useState<Decision | null>(null);
    const [photoInputKey, setPhotoInputKey] = useState(0);
    const startForm = useForm({ verification: '' });
    const inspectionForm = useForm({
        boundary_revision: inspection?.boundary_revision ?? 0,
        farm_exists: inspection?.checklist.farm_exists === true,
        location_matches: inspection?.checklist.location_matches === true,
        crop_observed:
            inspection?.checklist.crop_observed === true ||
            (farm.crop_label === 'Coffee' &&
                inspection?.checklist.coffee_crop_observed === true),
        boundary_captured: inspection?.checklist.boundary_captured === true,
        area_checked: inspection?.checklist.area_checked === true,
        farmer_or_representative_met:
            inspection?.checklist.farmer_or_representative_met === true,
        evidence_type: 'general_farm_view',
        evidence_photo: null as File | null,
        latitude: '',
        longitude: '',
        remarks:
            typeof inspection?.checklist.observations === 'string'
                ? inspection.checklist.observations
                : '',
    });
    const reviewForm = useForm({
        result: '' as Decision | '',
        remarks: '',
        verification: '',
    });
    const previousBoundaryRevision = useRef(inspection?.boundary_revision ?? 0);
    useEffect(() => {
        const currentRevision = inspection?.boundary_revision ?? 0;

        if (previousBoundaryRevision.current === currentRevision) {
            return;
        }

        previousBoundaryRevision.current = currentRevision;
        inspectionForm.setData((data) => ({
            ...data,
            boundary_revision: currentRevision,
            farm_exists: false,
            location_matches: false,
            crop_observed: false,
            boundary_captured: false,
            area_checked: false,
            farmer_or_representative_met: false,
            evidence_photo: null,
        }));
        setPhotoInputKey((key) => key + 1);
    }, [inspection?.boundary_revision]);
    const inProgress = farm.verification_status === 'in_progress';
    const hasFreshBoundary = inspection?.boundary_captured_for_attempt === true;
    const activeChecklist = inspection?.checklist ?? {};
    const inspectionReady = Boolean(
        hasFreshBoundary &&
        Object.keys(activeChecklist).length > 0 &&
        inspectionChecks.every(
            ({ key }) =>
                typeof activeChecklist[key] === 'boolean' ||
                (key === 'crop_observed' &&
                    farm.crop_label === 'Coffee' &&
                    typeof activeChecklist.coffee_crop_observed === 'boolean'),
        ) &&
        (inspection?.photos.length ?? 0) > 0,
    );
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

    function saveInspection() {
        inspectionForm.post(inspectionRoute.url(farm.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                inspectionForm.setData('evidence_photo', null);
                setPhotoInputKey((key) => key + 1);
            },
        });
    }

    function captureLocation() {
        if (!navigator.geolocation) {
            return;
        }

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                inspectionForm.setData('latitude', String(coords.latitude));
                inspectionForm.setData('longitude', String(coords.longitude));
            },
            () => undefined,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
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
                    <StatCard
                        label="Verified Area"
                        value={farm.verified_area}
                    />
                    <StatCard
                        label="Difference"
                        value={comparison.difference}
                    />
                    <StatCard label="Variance" value={comparison.variance} />
                </section>

                {!comparison.has_boundary && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Boundary not yet captured</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">
                                Start the verification session, then capture and
                                save the GPS boundary during the field visit.
                            </p>
                            {inProgress && (
                                <p className="text-sm text-muted-foreground">
                                    Capture the perimeter with device GPS in the
                                    SureFarm Field Verifier mobile app. The web
                                    map is read-only during an active field
                                    visit.
                                </p>
                            )}
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
                                    can_manage_boundary:
                                        boundary.can_manage_boundary,
                                    can_remove_boundary: false,
                                }}
                                boundary={boundary}
                            />
                        </CardContent>
                    </Card>
                )}

                {!inProgress && (
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
                                Starting records the declared area. A fresh GPS
                                boundary must be captured and saved during this
                                field visit before the result can be submitted.
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
                                {startForm.processing
                                    ? 'Starting...'
                                    : 'Start Verification'}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {comparison.has_boundary && inProgress && !hasFreshBoundary && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Fresh GPS boundary required</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <p className="text-sm text-muted-foreground">
                                The previous boundary remains available for
                                reference. Capture and save the farm perimeter
                                now to continue this verification.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Capture and save a new boundary with device GPS
                                in the SureFarm Field Verifier mobile app. This
                                web map remains read-only during the visit.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {comparison.has_boundary && inProgress && hasFreshBoundary && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Field inspection and evidence</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-5">
                            <p className="text-sm text-muted-foreground">
                                Record each field check and attach evidence to
                                the current saved boundary before deciding the
                                result. You can submit additional photos with
                                the same checklist.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {inspectionChecks.map(({ key, label }) => (
                                    <label
                                        key={key}
                                        className="flex min-h-11 items-center gap-3 rounded-md border p-3 text-sm"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={inspectionForm.data[key]}
                                            onChange={(event) =>
                                                inspectionForm.setData(
                                                    key,
                                                    event.target.checked,
                                                )
                                            }
                                            className="size-4 accent-primary"
                                        />
                                        <span>
                                            {key === 'crop_observed'
                                                ? `${farm.crop_label} observed`
                                                : label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                            <label className="grid max-w-xl gap-2 text-sm">
                                <span className="font-medium">
                                    Evidence photo category
                                </span>
                                <select
                                    value={inspectionForm.data.evidence_type}
                                    onChange={(event) =>
                                        inspectionForm.setData(
                                            'evidence_type',
                                            event.target.value,
                                        )
                                    }
                                    className="h-10 rounded-md border border-input bg-background px-3"
                                >
                                    <option value="farm_entrance">
                                        Farm entrance
                                    </option>
                                    <option value="crop_plants">
                                        Crop plants
                                    </option>
                                    <option value="coffee_plants">
                                        Coffee plants
                                    </option>
                                    <option value="farm_boundary">
                                        Farm boundary
                                    </option>
                                    <option value="general_farm_view">
                                        General farm view
                                    </option>
                                    <option value="other">Other</option>
                                </select>
                            </label>
                            <label className="grid max-w-xl gap-2 text-sm">
                                <span className="font-medium">
                                    Evidence photo
                                </span>
                                <input
                                    key={photoInputKey}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(event) =>
                                        inspectionForm.setData(
                                            'evidence_photo',
                                            event.target.files?.[0] ?? null,
                                        )
                                    }
                                    className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                                {inspectionForm.errors.evidence_photo && (
                                    <span className="text-sm text-destructive">
                                        {inspectionForm.errors.evidence_photo}
                                    </span>
                                )}
                            </label>
                            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                <label className="grid gap-2 text-sm">
                                    <span className="font-medium">
                                        Photo latitude (optional)
                                    </span>
                                    <input
                                        inputMode="decimal"
                                        value={inspectionForm.data.latitude}
                                        onChange={(event) =>
                                            inspectionForm.setData(
                                                'latitude',
                                                event.target.value,
                                            )
                                        }
                                        className="h-10 rounded-md border border-input bg-background px-3"
                                    />
                                </label>
                                <label className="grid gap-2 text-sm">
                                    <span className="font-medium">
                                        Photo longitude (optional)
                                    </span>
                                    <input
                                        inputMode="decimal"
                                        value={inspectionForm.data.longitude}
                                        onChange={(event) =>
                                            inspectionForm.setData(
                                                'longitude',
                                                event.target.value,
                                            )
                                        }
                                        className="h-10 rounded-md border border-input bg-background px-3"
                                    />
                                </label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={captureLocation}
                                >
                                    Use current location
                                </Button>
                            </div>
                            <label className="grid max-w-2xl gap-2 text-sm">
                                <span className="font-medium">
                                    Field observations
                                </span>
                                <textarea
                                    value={inspectionForm.data.remarks}
                                    onChange={(event) =>
                                        inspectionForm.setData(
                                            'remarks',
                                            event.target.value,
                                        )
                                    }
                                    rows={3}
                                    maxLength={2000}
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                                    placeholder="Record observations from the visit"
                                />
                            </label>
                            {inspectionForm.errors.verification && (
                                <p className="text-sm text-destructive">
                                    {inspectionForm.errors.verification}
                                </p>
                            )}
                            <Button
                                type="button"
                                className="w-fit"
                                disabled={
                                    inspectionForm.processing ||
                                    inspectionForm.data.evidence_photo === null
                                }
                                onClick={saveInspection}
                            >
                                {inspectionForm.processing
                                    ? 'Saving inspection...'
                                    : 'Save checklist and photo'}
                            </Button>
                            {inspection?.photos.length ? (
                                <div className="grid gap-2">
                                    <h3 className="text-sm font-medium">
                                        Uploaded evidence
                                    </h3>
                                    <ul className="grid gap-2 sm:grid-cols-2">
                                        {inspection.photos.map((photo) => (
                                            <li
                                                key={photo.id}
                                                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                                            >
                                                <a
                                                    href={photo.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="min-w-0 truncate font-medium text-primary underline-offset-4 hover:underline"
                                                >
                                                    {photo.name}
                                                </a>
                                                <div className="shrink-0 text-right text-xs text-muted-foreground">
                                                    <p>
                                                        {photo.type.replace(
                                                            /_/g,
                                                            ' ',
                                                        )}
                                                    </p>
                                                    <p>
                                                        {photo.captured_at
                                                            ? `Captured ${new Date(photo.captured_at).toLocaleString()}`
                                                            : 'Capture time unavailable'}
                                                    </p>
                                                    {photo.uploaded_at && (
                                                        <p>
                                                            Uploaded{' '}
                                                            {new Date(
                                                                photo.uploaded_at,
                                                            ).toLocaleString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>
                )}

                {inProgress && inspectionReady && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Verification review</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <label
                                className="grid gap-2 text-sm"
                                htmlFor="verification-remarks"
                            >
                                <span className="font-medium">
                                    Verification Remarks
                                </span>
                                <textarea
                                    id="verification-remarks"
                                    value={reviewForm.data.remarks}
                                    onChange={(event) =>
                                        reviewForm.setData(
                                            'remarks',
                                            event.target.value,
                                        )
                                    }
                                    rows={4}
                                    aria-invalid={Boolean(
                                        reviewForm.errors.remarks,
                                    )}
                                    aria-describedby={
                                        reviewForm.errors.remarks
                                            ? 'verification-remarks-error'
                                            : undefined
                                    }
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    placeholder="Notes for this review"
                                />
                            </label>
                            {reviewForm.errors.remarks && (
                                <p
                                    id="verification-remarks-error"
                                    className="text-sm text-destructive"
                                    role="alert"
                                >
                                    {reviewForm.errors.remarks}
                                </p>
                            )}
                            {reviewForm.errors.verification && (
                                <p className="text-sm text-destructive">
                                    {reviewForm.errors.verification}
                                </p>
                            )}
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    disabled={reviewForm.processing}
                                    onClick={() => setDecision('verified')}
                                >
                                    Approve Verification
                                </Button>
                                <Button
                                    variant="destructive"
                                    disabled={reviewForm.processing}
                                    onClick={() => setDecision('failed')}
                                >
                                    Mark as Failed
                                </Button>
                                <Button
                                    variant="secondary"
                                    disabled={reviewForm.processing}
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
                            {reviewForm.processing
                                ? 'Saving...'
                                : pendingDecision?.confirm}
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
