const plots = [
    { name: 'North plot', points: '70,150 180,90 250,160 160,230' },
    { name: 'Ridge plot', points: '280,120 420,80 470,180 330,210' },
    { name: 'Valley plot', points: '120,280 250,250 300,340 150,370' },
    { name: 'East plot', points: '360,260 520,220 560,330 390,360' },
];

export function MapShowcase() {
    return (
        <section className="py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
                <div className="max-w-2xl">
                    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                        See your farms on the map.
                    </h2>
                    <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                        Registered farms can be viewed with their locations and
                        boundaries. The drawing below is only a visual example.
                    </p>
                </div>
                <figure className="mt-10 overflow-hidden rounded-3xl border bg-card shadow-sm">
                    <svg
                        viewBox="0 0 720 420"
                        role="img"
                        aria-label="Stylized map with four example farm plots and location markers"
                        className="h-auto w-full"
                    >
                        <rect width="720" height="420" className="fill-muted" />
                        <g className="stroke-border" strokeWidth="1">
                            {Array.from({ length: 14 }, (_, index) => (
                                <line
                                    key={`mv-${index}`}
                                    x1={index * 56}
                                    y1="0"
                                    x2={index * 56}
                                    y2="420"
                                />
                            ))}
                            {Array.from({ length: 8 }, (_, index) => (
                                <line
                                    key={`mh-${index}`}
                                    x1="0"
                                    y1={index * 60}
                                    x2="720"
                                    y2={index * 60}
                                />
                            ))}
                        </g>
                        {plots.map((plot) => (
                            <polygon
                                key={plot.name}
                                points={plot.points}
                                className="fill-primary/25 stroke-primary"
                                strokeWidth="2.5"
                                strokeLinejoin="round"
                            />
                        ))}
                        <g className="fill-secondary-foreground">
                            <circle cx="180" cy="90" r="6" />
                            <circle cx="420" cy="80" r="6" />
                            <circle cx="250" cy="250" r="6" />
                            <circle cx="520" cy="220" r="6" />
                        </g>
                        <g className="fill-foreground text-[13px] font-medium">
                            <text x="78" y="78">
                                North plot
                            </text>
                            <text x="330" y="68">
                                Ridge plot
                            </text>
                            <text x="128" y="268">
                                Valley plot
                            </text>
                            <text x="400" y="248">
                                East plot
                            </text>
                        </g>
                    </svg>
                    <figcaption className="border-t px-5 py-4 text-sm text-muted-foreground">
                        Illustration only. These plots are not farms stored in
                        SureFarm.
                    </figcaption>
                </figure>
            </div>
        </section>
    );
}
