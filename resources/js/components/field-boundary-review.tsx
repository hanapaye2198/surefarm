import { Link } from '@inertiajs/react';
import { ArrowLeft, CircleAlert, Crosshair, Pencil } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    SectionTabs,
    sectionPanelId,
    sectionTabId,
} from '@/components/section-tabs';
import { index as farmsIndex } from '@/routes/farms';

export type FieldNeighbor = {
    id: number;
    farm_id: string;
    farm_name: string;
    hectares: number;
    geojson: {
        type: 'Polygon';
        coordinates: [number, number][][];
    };
    overlap_percent: number | null;
};

export type FieldReview = {
    verified_area_hectares: number | null;
    purok_sitio: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
    area_declarations: {
        id: number;
        previous_area_hectares: number | null;
        declared_area_hectares: number;
        event_type: string;
        recorded_by: string | null;
        recorded_at: string | null;
    }[];
    neighbors: FieldNeighbor[];
    overlaps: {
        id: number;
        farm_id: string;
        farm_name: string;
        percent: number;
    }[];
    mismatch: {
        active_hectares: number;
        verified_hectares: number;
    } | null;
};

export type FieldLayer = 'active' | 'neighbors' | 'both';

type ReviewPanel = 'size' | 'info' | 'history';

const reviewTabs = [
    { value: 'size', label: 'Field size' },
    { value: 'info', label: 'Info' },
    { value: 'history', label: 'Changelog' },
] as const;

const areaFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function hectares(value: number): string {
    return `${areaFormatter.format(value)} ha`;
}

function place(review: FieldReview): string {
    const parts = [
        review.purok_sitio,
        review.barangay,
        review.municipality,
        review.province,
    ].filter((part) => part && part.trim() !== '');

    return parts.length > 0 ? parts.join(', ') : 'Location has not been recorded yet.';
}

function declarationLabel(eventType: string): string {
    if (eventType === 'legacy_baseline') {
        return 'Baseline at history rollout';
    }

    if (eventType === 'initial') {
        return 'Initial declaration';
    }

    return 'Declared area updated';
}

export function FieldBoundaryReview({
    review,
    farmId,
    farmName,
    farmerName,
    declaredHectares,
    measuredHectares,
    boundary,
    mode,
    layer,
    panel,
    canManage,
    canRemove,
    saving,
    pointCount,
    formError,
    showPreviewNote,
    onLayer,
    onPanel,
    onCentre,
    onDraw,
    onEdit,
    onCancel,
    onFinish,
    onClearPoints,
    onSave,
    onRedraw,
    onRemove,
}: {
    review: FieldReview;
    farmId: string;
    farmName: string;
    farmerName: string;
    declaredHectares: number;
    measuredHectares: number | null;
    boundary: {
        capture_method: string | null;
        captured_by: string | null;
        captured_at: string | null;
        updated_by: string | null;
    } | null;
    mode: 'view' | 'draw' | 'preview' | 'edit';
    layer: FieldLayer;
    panel: ReviewPanel;
    canManage: boolean;
    canRemove: boolean;
    saving: boolean;
    pointCount: number;
    formError?: string;
    showPreviewNote: boolean;
    onLayer: (layer: FieldLayer) => void;
    onPanel: (panel: ReviewPanel) => void;
    onCentre: () => void;
    onDraw: () => void;
    onEdit: () => void;
    onCancel: () => void;
    onFinish: () => void;
    onClearPoints: () => void;
    onSave: () => void;
    onRedraw: () => void;
    onRemove: () => void;
}) {
    return (
        <aside className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto border-b bg-card p-4 lg:max-h-none lg:border-r lg:border-b-0">
            <div className="grid gap-3">
                <Link
                    href={farmsIndex()}
                    className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="size-4" />
                    Back
                </Link>
                <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Field id
                    </p>
                    <p className="text-lg font-semibold">{farmId}</p>
                    <p className="text-sm text-muted-foreground">{farmName}</p>
                </div>
                <button
                    type="button"
                    onClick={onCentre}
                    className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary"
                >
                    <Crosshair className="size-4" />
                    Center on map
                </button>
                <select
                    aria-label="Boundary layers"
                    value={layer}
                    onChange={(event) => onLayer(event.target.value as FieldLayer)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                    <option value="both">Active + neighboring fields</option>
                    <option value="active">Active boundary</option>
                    <option value="neighbors">Neighboring fields</option>
                </select>
            </div>

            {mode === 'view' ? (
                <>
                    <SectionTabs
                        tabs={reviewTabs}
                        value={panel}
                        onValueChange={onPanel}
                        label="Field details"
                        idPrefix="field-boundary"
                    />
                    <div
                        role="tabpanel"
                        id={sectionPanelId('field-boundary', panel)}
                        aria-labelledby={sectionTabId('field-boundary', panel)}
                        tabIndex={0}
                        className="grid gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {panel === 'size' && (
                            <>
                                {review.overlaps.map((overlap) => (
                                    <Alert key={overlap.id} variant="destructive">
                                        <CircleAlert />
                                        <AlertTitle>Fix boundary overlap</AlertTitle>
                                        <AlertDescription>
                                            Active boundary has{' '}
                                            {areaFormatter.format(overlap.percent)}%
                                            overlap with field {overlap.farm_id}.
                                        </AlertDescription>
                                    </Alert>
                                ))}
                                {review.mismatch && (
                                    <Alert variant="warning">
                                        <CircleAlert />
                                        <AlertTitle>Review boundary mismatch</AlertTitle>
                                        <AlertDescription>
                                            The active boundary is{' '}
                                            {hectares(review.mismatch.active_hectares)}{' '}
                                            and the verified area is{' '}
                                            {hectares(review.mismatch.verified_hectares)}.
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <dl className="grid gap-3 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Active</dt>
                                        <dd className="font-medium tabular-nums">
                                            {measuredHectares === null
                                                ? 'Not yet measured'
                                                : hectares(measuredHectares)}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">
                                            Former reported
                                        </dt>
                                        <dd className="font-medium tabular-nums">
                                            {hectares(declaredHectares)}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">MRV</dt>
                                        <dd className="font-medium tabular-nums">
                                            {review.verified_area_hectares === null
                                                ? 'Not yet verified'
                                                : hectares(review.verified_area_hectares)}
                                        </dd>
                                    </div>
                                </dl>
                                <p className="text-xs text-muted-foreground">
                                    Active is the saved boundary. Former reported
                                    is the area the farmer declared. MRV is the
                                    verified area.
                                </p>
                            </>
                        )}
                        {panel === 'info' && (
                            <dl className="grid gap-3 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Farmer
                                    </dt>
                                    <dd>{farmerName}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Location
                                    </dt>
                                    <dd>{place(review)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Boundary
                                    </dt>
                                    <dd>
                                        {boundary
                                            ? 'Boundary captured'
                                            : 'No boundary has been captured yet.'}
                                    </dd>
                                </div>
                                {boundary && (
                                    <>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">
                                                Captured by
                                            </dt>
                                            <dd>{boundary.captured_by ?? '—'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">
                                                Capture method
                                            </dt>
                                            <dd>
                                                {boundary.capture_method === 'device_gps'
                                                    ? 'Device GPS'
                                                    : boundary.capture_method === 'map_manual'
                                                      ? 'Map drawn manually'
                                                      : 'Not recorded'}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">
                                                Saved
                                            </dt>
                                            <dd>{boundary.captured_at ?? '—'}</dd>
                                        </div>
                                        {boundary.updated_by && (
                                            <div>
                                                <dt className="text-xs text-muted-foreground">
                                                    Updated by
                                                </dt>
                                                <dd>{boundary.updated_by}</dd>
                                            </div>
                                        )}
                                    </>
                                )}
                            </dl>
                        )}
                        {panel === 'history' &&
                            (review.area_declarations.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    Changes to the reported area will appear here.
                                </p>
                            ) : (
                                <div className="grid gap-3">
                                    {review.area_declarations.map((entry) => (
                                        <div key={entry.id} className="grid gap-1">
                                            <p className="text-sm font-medium">
                                                {declarationLabel(entry.event_type)}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {entry.previous_area_hectares === null
                                                    ? ''
                                                    : `${hectares(entry.previous_area_hectares)} to `}
                                                {hectares(entry.declared_area_hectares)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {entry.recorded_at ?? 'Date not recorded'}
                                                {' · '}
                                                {entry.recorded_by ?? 'System baseline'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ))}
                    </div>
                    <div className="mt-auto grid gap-2">
                        {canManage && boundary === null && (
                            <Button type="button" onClick={onDraw}>
                                <Pencil />
                                Draw active boundary
                            </Button>
                        )}
                        {canManage && boundary !== null && (
                            <Button type="button" onClick={onEdit}>
                                <Pencil />
                                Edit active boundary
                            </Button>
                        )}
                        {canRemove && boundary !== null && (
                            <Button type="button" variant="outline" onClick={onRemove}>
                                Remove boundary
                            </Button>
                        )}
                    </div>
                </>
            ) : (
                <div className="mt-auto grid gap-3">
                    {mode === 'draw' && (
                        <p className="text-sm text-muted-foreground">
                            Click on the map to add boundary points.
                        </p>
                    )}
                    {mode === 'preview' && (
                        <p className="text-sm font-medium">Boundary preview</p>
                    )}
                    {mode === 'edit' && (
                        <p className="text-sm text-muted-foreground">
                            Drag the points to reshape the active boundary.
                        </p>
                    )}
                    {showPreviewNote && (
                        <p className="text-xs text-muted-foreground">
                            This preview is not saved until you click Save
                            boundary. It does not verify the farm.
                        </p>
                    )}
                    {formError && (
                        <p className="text-sm text-destructive">{formError}</p>
                    )}
                    {mode === 'draw' && (
                        <>
                            <Button
                                type="button"
                                onClick={onFinish}
                                disabled={pointCount < 3}
                            >
                                Finish boundary
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClearPoints}
                                disabled={pointCount === 0}
                            >
                                Clear boundary
                            </Button>
                            <Button type="button" variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        </>
                    )}
                    {(mode === 'preview' || mode === 'edit') && (
                        <>
                            <Button
                                type="button"
                                onClick={onSave}
                                disabled={saving || pointCount < 3}
                            >
                                Save boundary
                            </Button>
                            <Button type="button" variant="outline" onClick={onRedraw}>
                                {mode === 'preview' ? 'Redraw' : 'Clear boundary'}
                            </Button>
                            <Button type="button" variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                        </>
                    )}
                </div>
            )}
        </aside>
    );
}
