const figures = [
    { label: 'Declared', value: '2.84 ha' },
    { label: 'Measured', value: '2.79 ha' },
    { label: 'Difference', value: '0.05 ha' },
    { label: 'Variance', value: '1.76%' },
];

export function VerificationShowcase() {
    return (
        <section className="border-t bg-muted/40 py-16 sm:py-20">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
                <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        From declared area to verified area.
                    </h2>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                        SureFarm keeps a farmer&apos;s declared hectares
                        separate from the area measured on the map, so a
                        reviewer can see the difference before verification.
                    </p>
                </div>
                <div className="rounded-3xl border bg-card p-5 shadow-sm sm:p-6">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Demonstration example
                    </p>
                    <dl className="mt-4 grid grid-cols-2 gap-3">
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
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
                        <span className="text-xs font-semibold tracking-wide uppercase">
                            Verified
                        </span>
                        <span className="text-sm font-medium">
                            Example outcome
                        </span>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                        These numbers are a demonstration only. They are not
                        loaded from SureFarm records.
                    </p>
                </div>
            </div>
        </section>
    );
}
