import { Head, Link, router, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { show as showFarmer } from '@/routes/farmers';
import { edit, index as cooperativesIndex, show } from '@/routes/cooperatives';
import { end, reactivate, store as storeMembership, suspend } from '@/routes/cooperatives/memberships';
import { destroy as revokeOfficer, store as storeOfficer } from '@/routes/cooperatives/officers';
import { update as updateStatus } from '@/routes/cooperatives/status';

type Membership = {
    id: number;
    status: string;
    status_label: string;
    joined_on: string | null;
    ended_on: string | null;
    origin: string;
    farmer_name: string;
    farmer_code: string | null;
    farmer_href_id: number | null;
    province: string | null;
};

type Paginated = {
    data: Membership[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type Officer = { id: number; name: string; assigned_on: string };
type HistoryRow = { id: number; summary: string; actor: string | null; created_at: string };

export default function CooperativeShow({
    cooperative,
    stats,
    harvests,
    memberships,
    officers,
    history,
    filters,
    can_manage,
}: {
    cooperative: { id: number; name: string; code: string | null; status: string; status_label: string };
    stats: {
        active_members: number;
        suspended_members: number;
        ended_members: number;
        farms: number;
        verified_farms: number;
        activities: number;
    };
    harvests: { unit: string; label: string }[];
    memberships: Paginated;
    officers: Officer[];
    history: HistoryRow[];
    filters: { from: string; to: string; search: string; membership: string };
    can_manage: boolean;
}) {
    const enroll = useForm({ farmer_code: '' });
    const officer = useForm({ email: '' });
    const nextStatus = cooperative.status === 'active' ? 'inactive' : 'active';

    function filter(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        router.get(show.url(cooperative.id, {
            query: {
                from: String(data.get('from') ?? ''),
                to: String(data.get('to') ?? ''),
                search: String(data.get('search') ?? ''),
                membership: String(data.get('membership') ?? ''),
            },
        }), {}, { preserveState: true, replace: true });
    }

    return (
        <>
            <Head title={cooperative.name} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={cooperative.name}
                    description={cooperative.code ? `${cooperative.code} · ${cooperative.status_label}` : cooperative.status_label}
                    actions={
                        <div className="flex flex-col gap-2 sm:flex-row">
                            {can_manage && (
                                <Button variant="outline" asChild>
                                    <Link href={edit.url(cooperative.id)}>Edit details</Link>
                                </Button>
                            )}
                            {can_manage && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" type="button">
                                            {nextStatus === 'inactive' ? 'Mark inactive' : 'Mark active'}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogTitle>Change cooperative status?</DialogTitle>
                                        <DialogDescription>
                                            Membership history stays. An inactive cooperative cannot take new members.
                                        </DialogDescription>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button type="button" variant="outline">Cancel</Button>
                                            </DialogClose>
                                            <Button
                                                type="button"
                                                onClick={() => router.put(updateStatus.url(cooperative.id), { status: nextStatus })}
                                            >
                                                Confirm status
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    }
                />

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <StatCard label="Active members" value={stats.active_members} />
                    <StatCard label="Suspended members" value={stats.suspended_members} />
                    <StatCard label="Ended memberships" value={stats.ended_members} />
                    <StatCard label="Farms" value={stats.farms} />
                    <StatCard label="Verified farms" value={stats.verified_farms} />
                    <StatCard label="Activities in period" value={stats.activities} />
                </section>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Completed harvest in period</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {harvests.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No completed harvest is recorded for this period.</p>
                        ) : (
                            <ul className="text-sm">
                                {harvests.map((harvest) => (
                                    <li key={harvest.unit}>{harvest.label}</li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-2 text-sm text-muted-foreground">Quantities stay in their recorded unit. kg, tons, and bags are not added together.</p>
                    </CardContent>
                </Card>

                <form onSubmit={filter} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Input name="search" defaultValue={filters.search} placeholder="Farmer ID or name" />
                    <select name="membership" defaultValue={filters.membership} className="border-input h-9 rounded-md border bg-transparent px-3 text-sm">
                        <option value="">All memberships</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="ended">Ended</option>
                    </select>
                    <Input name="from" type="date" defaultValue={filters.from} aria-label="From" />
                    <Input name="to" type="date" defaultValue={filters.to} aria-label="To" />
                    <Button type="submit" variant="outline">Apply</Button>
                </form>

                {can_manage && (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            enroll.post(storeMembership.url(cooperative.id));
                        }}
                        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end"
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="farmer_code">Add farmer by ID</Label>
                            <Input id="farmer_code" value={enroll.data.farmer_code} onChange={(event) => enroll.setData('farmer_code', event.target.value)} placeholder="SF-000101" />
                            <InputError message={enroll.errors.farmer_code} />
                        </div>
                        <Button type="submit" disabled={enroll.processing}>Add member</Button>
                    </form>
                )}

                <DataTable
                    columns={['Farmer', 'Status', 'Joined', 'Ended', 'Record', '']}
                    rows={memberships.data.map((membership) => ({
                        id: membership.id,
                        cells: [
                            membership.farmer_href_id ? (
                                <Link key="farmer" href={showFarmer(membership.farmer_href_id)} className="font-medium hover:underline">
                                    {membership.farmer_name}
                                    {membership.farmer_code ? ` · ${membership.farmer_code}` : ''}
                                </Link>
                            ) : (
                                <span key="farmer">
                                    {membership.farmer_name}
                                    {membership.farmer_code ? ` · ${membership.farmer_code}` : ''}
                                </span>
                            ),
                            membership.status_label,
                            membership.joined_on ?? '—',
                            membership.ended_on ?? '—',
                            membership.origin,
                            can_manage ? (
                                <MembershipActions key="actions" cooperativeId={cooperative.id} membership={membership} />
                            ) : '—',
                        ],
                    }))}
                    emptyTitle="No memberships"
                    emptyDescription="Farmers appear here after they join this cooperative."
                />

                {memberships.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">Showing {memberships.from}–{memberships.to} of {memberships.total}</p>
                        <div className="flex gap-2">
                            {memberships.prev_page_url && <Button variant="outline" asChild><Link href={memberships.prev_page_url}>Previous</Link></Button>}
                            {memberships.next_page_url && <Button variant="outline" asChild><Link href={memberships.next_page_url}>Next</Link></Button>}
                        </div>
                    </div>
                )}

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Officers</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <p className="text-sm text-muted-foreground">
                            An officer sees this cooperative's farmers and farms. Membership does not grant access to government IDs, bank accounts, financing, or insurance.
                        </p>
                        {officers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No open officer assignment.</p>
                        ) : (
                            officers.map((row) => (
                                <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
                                    <span>{row.name} · assigned {row.assigned_on}</span>
                                    {can_manage && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => router.delete(revokeOfficer.url({ cooperative: cooperative.id, officer: row.id }))}
                                        >
                                            End assignment
                                        </Button>
                                    )}
                                </div>
                            ))
                        )}
                        {can_manage && (
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    officer.post(storeOfficer.url(cooperative.id));
                                }}
                                className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
                            >
                                <div className="grid gap-2">
                                    <Label htmlFor="email">Officer email</Label>
                                    <Input id="email" type="email" value={officer.data.email} onChange={(event) => officer.setData('email', event.target.value)} />
                                    <InputError message={officer.errors.email} />
                                </div>
                                <Button type="submit" variant="outline" disabled={officer.processing}>Assign officer</Button>
                            </form>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>History</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No recorded changes yet.</p>
                        ) : (
                            history.map((event) => (
                                <div key={event.id} className="border-b pb-3 text-sm last:border-0 last:pb-0">
                                    <p>{event.summary}</p>
                                    <p className="text-xs text-muted-foreground">{event.created_at}{event.actor ? ` · ${event.actor}` : ''}</p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function MembershipActions({ cooperativeId, membership }: { cooperativeId: number; membership: Membership }) {
    if (membership.status === 'ended') {
        return <span className="text-muted-foreground">Closed</span>;
    }

    return (
        <div className="flex gap-2">
            {membership.status === 'active' && (
                <Button type="button" size="sm" variant="outline" onClick={() => router.put(suspend.url({ cooperative: cooperativeId, membership: membership.id }))}>
                    Suspend
                </Button>
            )}
            {membership.status === 'suspended' && (
                <Button type="button" size="sm" variant="outline" onClick={() => router.put(reactivate.url({ cooperative: cooperativeId, membership: membership.id }))}>
                    Reactivate
                </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={() => router.put(end.url({ cooperative: cooperativeId, membership: membership.id }))}>
                End
            </Button>
        </div>
    );
}

CooperativeShow.layout = {
    breadcrumbs: [{ title: 'Cooperatives', href: cooperativesIndex() }],
};
