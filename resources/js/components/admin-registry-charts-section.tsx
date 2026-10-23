import {
    ComparisonChart,
    CropChart,
    GeographyChart,
    OwnerChart,
    StatusChart,
    TrendChart,
} from '@/components/admin-registry-charts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RegistryPayload } from '@/types/admin-dashboard';

export function AdminRegistryCharts({ registry }: { registry: RegistryPayload }) {
    const level =
        registry.charts.geography.level === 'municipality'
            ? 'municipality'
            : registry.charts.geography.level === 'barangay'
              ? 'barangay'
              : 'province';

    return (
        <>
            <section id="distribution" className="grid scroll-mt-24 gap-4 lg:grid-cols-2">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Declared and verified area</CardTitle>
                        <CardDescription>Hectares for the farms matching the current filters.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ComparisonChart rows={registry.charts.comparison} />
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Area by {level}</CardTitle>
                        <CardDescription>Declared hectares and recorded verified hectares.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <GeographyChart level={level} rows={registry.charts.geography.rows} />
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Area by crop</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CropChart rows={registry.charts.crops} />
                    </CardContent>
                </Card>
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Verification status</CardTitle>
                        <CardDescription>Farm counts and the declared hectares in each status.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <StatusChart rows={registry.charts.statuses} />
                    </CardContent>
                </Card>
            </section>
            <section id="ownership" className="scroll-mt-24">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Area by registered farmer</CardTitle>
                        <CardDescription>
                            Ranked by {registry.filters.rank === 'verified' ? 'verified' : 'declared'} hectares. A farmer can have more than one farm.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OwnerChart rows={registry.charts.owners} rank={registry.filters.rank} />
                    </CardContent>
                </Card>
            </section>
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Registration activity</CardTitle>
                </CardHeader>
                <CardContent>
                    <TrendChart
                        points={registry.charts.trend.points}
                        note={registry.charts.trend.note}
                        window={registry.charts.trend.window}
                    />
                </CardContent>
            </Card>
        </>
    );
}
