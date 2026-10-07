export type InventoryStage = {
    id: number;
    name: string;
    code: string;
    sequence: number;
    quantity: number;
    unit: string;
    label: string;
};

export type InventorySummary = {
    stages: InventoryStage[];
    total_label: string;
    has_records: boolean;
    chart: {
        name: string;
        quantity: number;
        unit: string;
        share: number;
    }[];
};

export function InventoryStageBars({ summary }: { summary: InventorySummary }) {
    return (
        <div className="grid gap-3">
            {summary.stages.map((stage) => {
                const share =
                    summary.chart.find((item) => item.name === stage.name)
                        ?.share ?? 0;

                return (
                    <div key={stage.id} className="grid gap-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span>{stage.name}</span>
                            <span className="font-medium tabular-nums">
                                {stage.label}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${share}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
