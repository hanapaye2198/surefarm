const figures = [
    { label: 'Declared', value: '2.50 ha' },
    { label: 'Measured', value: '2.46 ha' },
    { label: 'Difference', value: '0.04 ha' },
    { label: 'Variance', value: '1.6%' },
];

export function VerificationShowcase() {
    return (
        <section
            id="verification"
            className="scroll-mt-20 border-t py-16 sm:py-20"
        >
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
                <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                        Area verification
                    </p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        Declared area stays separate until it is checked.
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                        A farmer&apos;s declared hectares and the area measured
                        from the boundary are stored side by side. A reviewer
                        sees the difference before the farm is marked verified.
                        Field teams can capture the boundary, GPS, and photos in
                        the mobile app.
                    </p>
                </div>
                <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Demo walkthrough
                            </p>
                            <p className="mt-1 font-semibold tracking-tight">
                                Kalasungay Coffee
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Malaybalay, Bukidnon
                            </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary uppercase">
                            Verified
                        </span>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3">
                        {figures.map((figure) => (
                            <div
                                key={figure.label}
                                className="rounded-2xl bg-muted/70 px-4 py-3"
                            >
                                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    {figure.label}
                                </dt>
                                <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                                    {figure.value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                            <span>Measured against declared</span>
                            <span className="tabular-nums">98.4%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full w-[98.4%] rounded-full bg-primary" />
                        </div>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                        These numbers come from the SureFarm demo walkthrough.
                        They are not loaded from your organization&apos;s
                        records.
                    </p>
                </div>
            </div>
        </section>
    );
}
