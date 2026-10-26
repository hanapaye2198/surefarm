import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
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
import {
    destroy as revokeInvitation,
    store as storeInvitation,
} from '@/routes/user-invitations';
import { show, update } from '@/routes/users';
import {
    destroy as restoreAccount,
    store as suspendAccount,
} from '@/routes/users/suspension';

type RoleOption = {
    value: string;
    label: string;
};

type AccountRow = {
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
};

type UserPage = {
    data: AccountRow[];
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

type UserStats = {
    total: number;
    active: number;
    suspended: number;
    open_invitations: number;
};

type UserFilters = {
    search: string;
    role: string;
    status: string;
    cooperative: number | string;
    assignment: string;
};

type InvitationRow = {
    id: number;
    name: string;
    email: string;
    role_label: string;
    expires_at: string;
    invited_by: string | null;
};

const selectClassName =
    'border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

function Field({
    label,
    htmlFor,
    error,
    children,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

function RoleControl({
    account,
    roles,
}: {
    account: AccountRow;
    roles: RoleOption[];
}) {
    const form = useForm({ role: account.role });
    const locked = account.is_self || account.is_last_administrator;

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.patch(update.url(account.id), { preserveScroll: true });
    }

    return (
        <form onSubmit={save} className="flex min-w-56 flex-col gap-2">
            <div className="flex items-center gap-2">
                <select
                    aria-label={`Role for ${account.name}`}
                    className={selectClassName}
                    value={form.data.role}
                    disabled={locked}
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
                <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={
                        locked ||
                        form.processing ||
                        form.data.role === account.role
                    }
                >
                    Save
                </Button>
            </div>
            <InputError message={form.errors.role} />
        </form>
    );
}

function SuspensionControl({ account }: { account: AccountRow }) {
    const form = useForm({
        user: '',
        invitation: '',
    });
    const locked =
        account.is_self ||
        (!account.suspended && account.is_last_administrator);

    if (account.suspended) {
        return (
            <div className="space-y-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={form.processing}
                    onClick={() =>
                        form.delete(restoreAccount.url(account.id), {
                            preserveScroll: true,
                        })
                    }
                >
                    Restore access
                </Button>
                <InputError message={form.errors.user} />
            </div>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={locked}
                >
                    Suspend
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogTitle>Suspend {account.name}?</DialogTitle>
                <DialogDescription>
                    They will be signed out and cannot sign in until an
                    administrator restores the account.
                </DialogDescription>
                <InputError message={form.errors.user} />
                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        variant="destructive"
                        disabled={form.processing}
                        onClick={() =>
                            form.post(suspendAccount.url(account.id), {
                                preserveScroll: true,
                            })
                        }
                    >
                        Suspend account
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function UsersIndex({
    users,
    invitations,
    roles,
    stats,
    filters,
    cooperatives,
}: {
    users: UserPage;
    invitations: InvitationRow[];
    roles: RoleOption[];
    stats: UserStats;
    filters: UserFilters;
    cooperatives: { id: number; name: string }[];
}) {
    const invite = useForm({
        name: '',
        email: '',
        role: 'operations',
    });

    function sendInvitation(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        invite.post(storeInvitation.url(), {
            preserveScroll: true,
            onSuccess: () => invite.reset('name', 'email'),
        });
    }

    return (
        <>
            <Head title="Users" />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title="Users"
                    description="Invite people, assign scope, and suspend access. Public registration is closed."
                />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(
                        [
                            ['Accounts', stats.total],
                            ['Active', stats.active],
                            ['Suspended', stats.suspended],
                            ['Open invitations', stats.open_invitations],
                        ] as const
                    ).map(([label, value]) => (
                        <Card key={label} className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    {label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-2xl font-semibold">
                                {value}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Invite a user</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={sendInvitation}
                            className="grid gap-4 sm:grid-cols-2"
                        >
                            <Field
                                label="Name"
                                htmlFor="invite-name"
                                error={invite.errors.name}
                            >
                                <Input
                                    id="invite-name"
                                    value={invite.data.name}
                                    onChange={(event) =>
                                        invite.setData(
                                            'name',
                                            event.target.value,
                                        )
                                    }
                                    required
                                />
                            </Field>
                            <Field
                                label="Email"
                                htmlFor="invite-email"
                                error={invite.errors.email}
                            >
                                <Input
                                    id="invite-email"
                                    type="email"
                                    value={invite.data.email}
                                    onChange={(event) =>
                                        invite.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                    required
                                />
                            </Field>
                            <Field
                                label="Role"
                                htmlFor="invite-role"
                                error={invite.errors.role}
                            >
                                <select
                                    id="invite-role"
                                    className={selectClassName}
                                    value={invite.data.role}
                                    onChange={(event) =>
                                        invite.setData(
                                            'role',
                                            event.target.value,
                                        )
                                    }
                                >
                                    {roles.map((role) => (
                                        <option
                                            key={role.value}
                                            value={role.value}
                                        >
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <div className="flex items-end">
                                <Button
                                    type="submit"
                                    disabled={invite.processing}
                                >
                                    Send invitation
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <h2 className="text-lg font-semibold tracking-tight">
                    Open invitations
                </h2>
                <DataTable
                    columns={[
                        'Name',
                        'Email',
                        'Role',
                        'Expires',
                        'Invited by',
                        '',
                    ]}
                    emptyTitle="No open invitations."
                    emptyDescription="Invitations expire after 72 hours and can be used once."
                    rows={invitations.map((invitation) => ({
                        id: invitation.id,
                        cells: [
                            invitation.name,
                            invitation.email,
                            invitation.role_label,
                            invitation.expires_at,
                            invitation.invited_by ?? '—',
                            <RevokeInvitation
                                key={invitation.id}
                                invitation={invitation}
                            />,
                        ],
                    }))}
                />

                <h2 className="text-lg font-semibold tracking-tight">
                    Accounts
                </h2>
                <form
                    method="get"
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
                >
                    <Input
                        name="search"
                        defaultValue={filters.search}
                        placeholder="Name or email"
                        aria-label="Search accounts"
                    />
                    <select
                        name="role"
                        defaultValue={filters.role}
                        className={selectClassName}
                        aria-label="Role"
                    >
                        <option value="">All roles</option>
                        {roles.map((role) => (
                            <option key={role.value} value={role.value}>
                                {role.label}
                            </option>
                        ))}
                    </select>
                    <select
                        name="status"
                        defaultValue={filters.status}
                        className={selectClassName}
                        aria-label="Status"
                    >
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                    </select>
                    <select
                        name="cooperative"
                        defaultValue={String(filters.cooperative)}
                        className={selectClassName}
                        aria-label="Cooperative"
                    >
                        <option value="">All cooperatives</option>
                        {cooperatives.map((cooperative) => (
                            <option key={cooperative.id} value={cooperative.id}>
                                {cooperative.name}
                            </option>
                        ))}
                    </select>
                    <select
                        name="assignment"
                        defaultValue={filters.assignment}
                        className={selectClassName}
                        aria-label="Assignment"
                    >
                        <option value="">Any assignment</option>
                        <option value="assigned">Has a farm assignment</option>
                    </select>
                    <Button type="submit" variant="outline">
                        Filter
                    </Button>
                </form>
                <DataTable
                    columns={[
                        'Name',
                        'Email',
                        'Organization',
                        'Security',
                        'Role',
                        'Access',
                    ]}
                    emptyTitle="No accounts match."
                    emptyDescription="Try another name, email, role, or status."
                    rows={users.data.map((account) => ({
                        id: account.id,
                        cells: [
                            account.name,
                            account.email,
                            account.organization ?? '—',
                            account.two_factor_confirmed
                                ? 'Two-factor confirmed'
                                : 'Two-factor not confirmed',
                            <RoleControl
                                key={`role-${account.id}`}
                                account={account}
                                roles={roles}
                            />,
                            <div
                                key={`access-${account.id}`}
                                className="space-y-2"
                            >
                                <p className="text-sm">
                                    {account.suspended ? 'Suspended' : 'Active'}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        key="manage"
                                        variant="outline"
                                        size="sm"
                                        asChild
                                    >
                                        <Link href={show(account.id)}>
                                            Manage
                                        </Link>
                                    </Button>
                                    <SuspensionControl account={account} />
                                </div>
                            </div>,
                        ],
                    }))}
                />
                {users.total > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">
                            Showing {users.from}–{users.to} of {users.total}
                        </p>
                        <div className="flex gap-2">
                            {users.prev_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={users.prev_page_url}>
                                        Previous
                                    </Link>
                                </Button>
                            )}
                            {users.next_page_url && (
                                <Button variant="outline" asChild>
                                    <Link href={users.next_page_url}>Next</Link>
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

function RevokeInvitation({ invitation }: { invitation: InvitationRow }) {
    const form = useForm({
        user: '',
        invitation: '',
    });

    return (
        <div className="space-y-2">
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={form.processing}
                onClick={() =>
                    form.delete(revokeInvitation.url(invitation.id), {
                        preserveScroll: true,
                    })
                }
            >
                Revoke
            </Button>
            <InputError message={form.errors.invitation} />
        </div>
    );
}
