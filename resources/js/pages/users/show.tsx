import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { DataTable } from '@/components/data-table';
import { PageHeader } from '@/components/page-header';
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
import { index as usersIndex, update } from '@/routes/users';
import {
    destroy as unlinkFarmer,
    store as linkFarmer,
} from '@/routes/users/farmer-link';
import {
    destroy as revokeAssignment,
    store as storeAssignment,
} from '@/routes/users/farm-assignments';
import {
    destroy as revokeGrant,
    store as storeGrant,
} from '@/routes/users/registry-grants';
import {
    destroy as restoreAccount,
    store as suspendAccount,
} from '@/routes/users/suspension';

type RoleOption = { value: string; label: string };

type Account = {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
    suspended: boolean;
    two_factor_confirmed: boolean;
    is_self: boolean;
    is_last_administrator: boolean;
    organization: string | null;
    created_at: string | null;
};

type FarmerLink = {
    farmer_code: string;
    name: string;
    cooperative: string | null;
} | null;

type GrantRow = {
    id: number;
    kind: string;
    province: string | null;
    open: boolean;
    granted_by: string | null;
    created_at: string | null;
};

type AssignmentRow = {
    id: number;
    farm_code: string | null;
    farm_name: string | null;
    open: boolean;
    assigned_by: string | null;
    assigned_at: string | null;
    scheduled_for: string | null;
    revoked_at: string | null;
};

type EventRow = {
    id: number;
    action: string;
    actor: string | null;
    metadata: Record<string, string | null> | null;
    created_at: string;
};

const selectClassName =
    'border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function UserShow({
    account,
    farmer,
    grants,
    assignments,
    events,
    roles,
}: {
    account: Account;
    farmer: FarmerLink;
    grants: GrantRow[];
    assignments: AssignmentRow[];
    events: EventRow[];
    roles: RoleOption[];
}) {
    return (
        <>
            <Head title={account.name} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={account.name}
                    description="Account access, farmer linkage, and assignment history."
                    actions={
                        <Button variant="outline" asChild>
                            <Link href={usersIndex()}>All accounts</Link>
                        </Button>
                    }
                />

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Account</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p>{account.email}</p>
                            <p>Role: {account.role_label}</p>
                            <p>
                                Status:{' '}
                                {account.suspended ? 'Suspended' : 'Active'}
                            </p>
                            <p>
                                Two-factor:{' '}
                                {account.two_factor_confirmed
                                    ? 'Confirmed'
                                    : 'Not confirmed'}
                            </p>
                            <p>
                                Scope:{' '}
                                {account.organization ?? 'No registry scope'}
                            </p>
                            <p>Created: {account.created_at ?? '—'}</p>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Role and status</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <RoleForm account={account} roles={roles} />
                            <StatusForm account={account} />
                        </CardContent>
                    </Card>
                </div>

                {account.role === 'farmer' && (
                    <FarmerLinkCard accountId={account.id} farmer={farmer} />
                )}

                {(account.role === 'admin' ||
                    account.role === 'operations') && (
                    <GrantCard accountId={account.id} grants={grants} />
                )}

                {account.role === 'field_verifier' && (
                    <AssignmentCard
                        accountId={account.id}
                        assignments={assignments}
                    />
                )}

                <h2 className="text-lg font-semibold tracking-tight">
                    Access history
                </h2>
                <DataTable
                    columns={['When', 'Action', 'By', 'Detail']}
                    emptyTitle="No access changes yet."
                    emptyDescription="Role, scope, link, and suspension changes are recorded here."
                    rows={events.map((event) => ({
                        id: event.id,
                        cells: [
                            event.created_at,
                            event.action,
                            event.actor ?? '—',
                            detail(event.metadata),
                        ],
                    }))}
                />
            </div>
        </>
    );
}

function detail(metadata: EventRow['metadata']): string {
    if (!metadata) {
        return '—';
    }

    return (
        Object.entries(metadata)
            .filter(([, value]) => value !== null && value !== '')
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ') || '—'
    );
}

function RoleForm({
    account,
    roles,
}: {
    account: Account;
    roles: RoleOption[];
}) {
    const form = useForm({ role: account.role });
    const locked = account.is_self || account.is_last_administrator;

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.patch(update.url(account.id), { preserveScroll: true });
    }

    return (
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <select
                    id="role"
                    className={selectClassName}
                    value={form.data.role}
                    disabled={locked || form.processing}
                    onChange={(event) =>
                        form.setData('role', event.target.value)
                    }
                >
                    {roles.map((role) => (
                        <option key={role.value} value={role.value}>
                            {role.label}
                        </option>
                    ))}
                </select>
                <InputError message={form.errors.role} />
                {locked && (
                    <p className="text-sm text-muted-foreground">
                        {account.is_self
                            ? 'You cannot change your own role.'
                            : 'The last active administrator cannot be demoted.'}
                    </p>
                )}
            </div>
            <div className="flex items-end">
                <Button type="submit" disabled={locked || form.processing}>
                    Save role
                </Button>
            </div>
        </form>
    );
}

function StatusForm({ account }: { account: Account }) {
    const form = useForm({ user: '' });
    const locked = account.is_self || account.is_last_administrator;

    return (
        <div className="space-y-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button
                        type="button"
                        variant={account.suspended ? 'outline' : 'destructive'}
                        disabled={locked || form.processing}
                    >
                        {account.suspended
                            ? 'Reactivate account'
                            : 'Suspend account'}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogTitle>
                        {account.suspended
                            ? 'Reactivate this account?'
                            : 'Suspend this account?'}
                    </DialogTitle>
                    <DialogDescription>
                        {account.suspended
                            ? 'The person can sign in again. Previous scope is kept.'
                            : 'Open sessions are ended. The account stays in the directory and can be restored.'}
                    </DialogDescription>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            variant={
                                account.suspended ? 'default' : 'destructive'
                            }
                            disabled={form.processing}
                            onClick={() =>
                                account.suspended
                                    ? form.delete(
                                          restoreAccount.url(account.id),
                                      )
                                    : form.post(suspendAccount.url(account.id))
                            }
                        >
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <InputError message={form.errors.user} />
        </div>
    );
}

function FarmerLinkCard({
    accountId,
    farmer,
}: {
    accountId: number;
    farmer: FarmerLink;
}) {
    const form = useForm({ farmer_code: '' });
    const unlink = useForm({ farmer_code: '' });

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(linkFarmer.url(accountId), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Farmer record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Link the account with the farmer ID printed on the registry
                    record. A matching name or phone number is not used.
                </p>
                {farmer && (
                    <p className="text-sm">
                        Linked to {farmer.name} ({farmer.farmer_code})
                        {farmer.cooperative ? `, ${farmer.cooperative}` : ''}.
                    </p>
                )}
                <form
                    onSubmit={save}
                    className="grid gap-3 sm:grid-cols-[1fr_auto]"
                >
                    <div className="grid gap-2">
                        <Label htmlFor="farmer_code">Farmer ID</Label>
                        <Input
                            id="farmer_code"
                            value={form.data.farmer_code}
                            onChange={(event) =>
                                form.setData('farmer_code', event.target.value)
                            }
                            placeholder="SF-000001"
                        />
                        <InputError message={form.errors.farmer_code} />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" disabled={form.processing}>
                            Link record
                        </Button>
                    </div>
                </form>
                {farmer && (
                    <ConfirmAction
                        title="Unlink this farmer record?"
                        description="The farmer, farms, and history stay in the registry. This account will no longer open them."
                        label="Unlink"
                        processing={unlink.processing}
                        onConfirm={() =>
                            unlink.delete(unlinkFarmer.url(accountId))
                        }
                        error={unlink.errors.farmer_code}
                    />
                )}
            </CardContent>
        </Card>
    );
}

function GrantCard({
    accountId,
    grants,
}: {
    accountId: number;
    grants: GrantRow[];
}) {
    const form = useForm({ kind: 'province', province: '' });

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(storeGrant.url(accountId), {
            preserveScroll: true,
            onSuccess: () => form.reset('province'),
        });
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Registry scope</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    A role does not open every record. Platform scope covers the
                    registry. A province scope covers only that province.
                </p>
                <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2">
                        <Label htmlFor="kind">Scope</Label>
                        <select
                            id="kind"
                            className={selectClassName}
                            value={form.data.kind}
                            onChange={(event) =>
                                form.setData('kind', event.target.value)
                            }
                        >
                            <option value="platform">Platform</option>
                            <option value="province">Province</option>
                        </select>
                        <InputError message={form.errors.kind} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="province">Province</Label>
                        <Input
                            id="province"
                            value={form.data.province}
                            onChange={(event) =>
                                form.setData('province', event.target.value)
                            }
                            disabled={form.data.kind !== 'province'}
                        />
                        <InputError message={form.errors.province} />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" disabled={form.processing}>
                            Grant access
                        </Button>
                    </div>
                </form>
                <GrantList accountId={accountId} grants={grants} />
            </CardContent>
        </Card>
    );
}

function GrantList({
    accountId,
    grants,
}: {
    accountId: number;
    grants: GrantRow[];
}) {
    return (
        <ul className="space-y-2 text-sm">
            {grants.length === 0 && (
                <li className="text-muted-foreground">No scope recorded.</li>
            )}
            {grants.map((grant) => (
                <GrantItem key={grant.id} accountId={accountId} grant={grant} />
            ))}
        </ul>
    );
}

function GrantItem({
    accountId,
    grant,
}: {
    accountId: number;
    grant: GrantRow;
}) {
    const form = useForm({ grant: '' });

    return (
        <li className="flex flex-wrap items-center justify-between gap-2">
            <span>
                {grant.kind === 'platform' ? 'Platform' : grant.province} ·{' '}
                {grant.open ? 'Open' : 'Revoked'}
                {grant.granted_by ? ` · ${grant.granted_by}` : ''}
            </span>
            {grant.open && (
                <ConfirmAction
                    title="Revoke this scope?"
                    description="The account keeps its role, but registry queries stop including this scope."
                    label="Revoke"
                    processing={form.processing}
                    onConfirm={() =>
                        form.delete(
                            revokeGrant.url({
                                user: accountId,
                                grant: grant.id,
                            }),
                        )
                    }
                    error={form.errors.grant}
                />
            )}
        </li>
    );
}

function AssignmentCard({
    accountId,
    assignments,
}: {
    accountId: number;
    assignments: AssignmentRow[];
}) {
    const form = useForm({ farm_code: '', scheduled_for: '' });

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(storeAssignment.url(accountId), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    }

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle>Farm assignments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Assignment allows inspection and verification of that farm.
                    It does not allow financial, identity, or inventory changes.
                </p>
                <form
                    onSubmit={save}
                    className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                    <div className="grid gap-2">
                        <Label htmlFor="farm_code">Farm ID</Label>
                        <Input
                            id="farm_code"
                            value={form.data.farm_code}
                            onChange={(event) =>
                                form.setData('farm_code', event.target.value)
                            }
                            placeholder="FARM-000001"
                        />
                        <InputError message={form.errors.farm_code} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="scheduled_for">
                            Visit date (optional)
                        </Label>
                        <Input
                            id="scheduled_for"
                            type="date"
                            value={form.data.scheduled_for}
                            onChange={(event) =>
                                form.setData(
                                    'scheduled_for',
                                    event.target.value,
                                )
                            }
                        />
                        <InputError message={form.errors.scheduled_for} />
                    </div>
                    <div className="flex items-end">
                        <Button type="submit" disabled={form.processing}>
                            Assign or schedule
                        </Button>
                    </div>
                </form>
                <ul className="space-y-2 text-sm">
                    {assignments.length === 0 && (
                        <li className="text-muted-foreground">
                            No farms assigned.
                        </li>
                    )}
                    {assignments.map((assignment) => (
                        <AssignmentItem
                            key={assignment.id}
                            accountId={accountId}
                            assignment={assignment}
                        />
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

function AssignmentItem({
    accountId,
    assignment,
}: {
    accountId: number;
    assignment: AssignmentRow;
}) {
    const scheduleForm = useForm({
        farm_code: assignment.farm_code ?? '',
        scheduled_for: assignment.scheduled_for ?? '',
    });
    const revokeForm = useForm({ assignment: '' });

    function saveSchedule(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        scheduleForm.post(storeAssignment.url(accountId), {
            preserveScroll: true,
        });
    }

    return (
        <li className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                    {assignment.farm_code} · {assignment.farm_name} ·{' '}
                    {assignment.open
                        ? 'Open'
                        : `Revoked ${assignment.revoked_at ?? ''}`}
                    {assignment.open && assignment.scheduled_for
                        ? ` · Scheduled ${assignment.scheduled_for}`
                        : ''}
                </span>
                {assignment.open && (
                    <ConfirmAction
                        title="Revoke this farm assignment?"
                        description="The verifier will no longer open this farm or its verification."
                        label="Revoke"
                        processing={revokeForm.processing}
                        onConfirm={() =>
                            revokeForm.delete(
                                revokeAssignment.url({
                                    user: accountId,
                                    assignment: assignment.id,
                                }),
                            )
                        }
                        error={revokeForm.errors.assignment}
                    />
                )}
            </div>
            {assignment.open && (
                <form
                    onSubmit={saveSchedule}
                    className="flex flex-wrap items-end gap-2"
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor={`schedule-${assignment.id}`}>
                            Visit date
                        </Label>
                        <Input
                            id={`schedule-${assignment.id}`}
                            type="date"
                            value={scheduleForm.data.scheduled_for}
                            onChange={(event) =>
                                scheduleForm.setData(
                                    'scheduled_for',
                                    event.target.value,
                                )
                            }
                        />
                        <InputError
                            message={scheduleForm.errors.scheduled_for}
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={scheduleForm.processing}
                    >
                        Save schedule
                    </Button>
                    <span className="text-xs text-muted-foreground">
                        Clear the date and save to remove the schedule.
                    </span>
                </form>
            )}
        </li>
    );
}
function ConfirmAction({
    title,
    description,
    label,
    processing,
    onConfirm,
    error,
}: {
    title: string;
    description: string;
    label: string;
    processing: boolean;
    onConfirm: () => void;
    error?: string;
}) {
    return (
        <div className="space-y-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={processing}
                    >
                        {label}
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancel
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={onConfirm}
                        >
                            {label}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <InputError message={error} />
        </div>
    );
}
