import { Head, Link, setLayoutProps, useForm } from '@inertiajs/react';
import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clientToken } from '@/lib/utils';
import { show as showFarm } from '@/routes/farms';
import {
    approve,
    cancel,
    defaultMethod,
    disburse,
    index as financeIndex,
    reject,
    review,
    show as showFinancing,
} from '@/routes/finance';
import { store as storeAdjustment } from '@/routes/finance/adjustments';
import { show as downloadDocument, store as storeDocument } from '@/routes/finance/documents';
import { store as storeRepayment } from '@/routes/finance/repayments';
import { reconcile, reverse } from '@/routes/finance/transactions';

type FinancingDetail = {
    id: number;
    reference: string;
    farm_record_id: number;
    farm_code: string;
    farm_name: string;
    farmer_name: string;
    farmer_code: string;
    province: string | null;
    municipality: string | null;
    production: string | null;
    purpose: string | null;
    type_label: string;
    status_label: string;
    balance_source: string;
    balance_source_label: string;
    currency: string;
    principal: string;
    interest_method: string;
    interest_rate: string | null;
    interest_amount: string;
    fee_amount: string;
    outstanding_principal: string;
    outstanding_interest: string;
    outstanding_fees: string;
    total_due: string;
    application_date: string;
    date_granted: string;
    due_date_label: string;
    maturity_date: string;
    frequency: string;
    installment_count: number | null;
    disbursement_reference: string | null;
    notes: string | null;
    rejection_reason: string | null;
    default_reason: string | null;
    submitted_by: string | null;
    approved_by: string | null;
    approved_at: string | null;
    uses_ledger: boolean;
};

type TransactionRow = {
    id: number;
    reference: string;
    type_label: string;
    component: string;
    direction: string;
    amount: string;
    occurred_on: string;
    reconciliation: string;
    notes: string | null;
    payment_method: string | null;
    external_reference: string | null;
    recorded_by: string | null;
    can_reverse: boolean;
    can_reconcile: boolean;
};

type DocumentRow = {
    id: number;
    name: string;
    uploaded_at: string;
    uploaded_by: string | null;
};

type HistoryRow = {
    id: number;
    action: string;
    actor: string;
    at: string;
    detail: string;
};

type Abilities = {
    review: boolean;
    approve: boolean;
    reject: boolean;
    cancel: boolean;
    disburse: boolean;
    repay: boolean;
    default: boolean;
    adjust: boolean;
    upload: boolean;
};

type Choice = { value: string; label: string };

const selectClassName =
    'border-input flex h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function FinanceShow({
    financing,
    transactions,
    documents,
    history,
    abilities,
    components,
    directions,
    today,
}: {
    financing: FinancingDetail;
    transactions: TransactionRow[];
    documents: DocumentRow[];
    history: HistoryRow[];
    abilities: Abilities;
    components: Choice[];
    directions: Choice[];
    today: string;
}) {
    setLayoutProps({
        breadcrumbs: [
            { title: 'Finance', href: financeIndex() },
            { title: financing.reference, href: showFinancing(financing.id) },
        ],
    });

    return (
        <>
            <Head title={financing.reference} />
            <div className="flex flex-col gap-5 sm:gap-6">
                <PageHeader
                    title={financing.reference}
                    description={`${financing.farmer_name} · ${financing.farm_name}`}
                    actions={
                        <>
                            <Badge variant="outline">{financing.status_label}</Badge>
                            <Button variant="outline" asChild>
                                <Link href={financeIndex()}>All financing</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link
                                    href={showFarm.url(financing.farm_record_id, {
                                        query: { tab: 'financing' },
                                    })}
                                >
                                    Open farm
                                </Link>
                            </Button>
                        </>
                    }
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Outstanding principal" value={financing.outstanding_principal} />
                    <Metric label="Outstanding interest" value={financing.outstanding_interest} />
                    <Metric label="Outstanding fees" value={financing.outstanding_fees} />
                    <Metric label="Total amount due" value={financing.total_due} />
                </div>

                {!financing.uses_ledger && (
                    <p className="text-sm text-muted-foreground">
                        This is a stated grant. The loan balance was entered on
                        the farm and is not reconstructed from payments.
                    </p>
                )}

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Agreement</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Detail label="Farmer" value={`${financing.farmer_name} (${financing.farmer_code})`} />
                        <Detail label="Farm" value={`${financing.farm_name} (${financing.farm_code})`} />
                        <Detail label="Location" value={[financing.municipality, financing.province].filter(Boolean).join(', ') || '—'} />
                        <Detail label="Crop cycle" value={financing.production || '—'} />
                        <Detail label="Purpose" value={financing.purpose || '—'} />
                        <Detail label="Type" value={financing.type_label} />
                        <Detail label="Balance source" value={financing.balance_source_label} />
                        <Detail label="Principal" value={financing.principal} />
                        <Detail label="Interest method" value={financing.interest_method} />
                        <Detail label="Interest rate" value={financing.interest_rate ? `${financing.interest_rate}%` : '—'} />
                        <Detail label="Stated interest" value={financing.interest_amount} />
                        <Detail label="Fee" value={financing.fee_amount} />
                        <Detail label="Application date" value={financing.application_date} />
                        <Detail label="Disbursed on" value={financing.date_granted} />
                        <Detail label="Due date" value={financing.due_date_label} />
                        <Detail label="Maturity" value={financing.maturity_date} />
                        <Detail label="Repayment" value={financing.frequency} />
                        <Detail label="Installments" value={financing.installment_count?.toString() || '—'} />
                        <Detail label="Disbursement reference" value={financing.disbursement_reference || '—'} />
                        <Detail label="Submitted by" value={financing.submitted_by || '—'} />
                        <Detail label="Approved by" value={financing.approved_by ? `${financing.approved_by} · ${financing.approved_at}` : '—'} />
                        <Detail label="Notes" value={financing.notes || '—'} />
                        {financing.rejection_reason && (
                            <Detail label="Rejection" value={financing.rejection_reason} />
                        )}
                        {financing.default_reason && (
                            <Detail label="Default" value={financing.default_reason} />
                        )}
                    </CardContent>
                </Card>

                {(abilities.review || abilities.approve || abilities.reject || abilities.cancel) && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Decision</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            {abilities.cancel &&
                                !abilities.review &&
                                !abilities.approve &&
                                !abilities.reject && (
                                    <p className="text-sm text-muted-foreground">
                                        You submitted this application. Another
                                        operations user has to review, approve,
                                        and disburse it.
                                    </p>
                                )}
                            <div className="flex flex-wrap gap-2">
                                {abilities.review && (
                                    <PostButton href={review.url(financing.id)} label="Start review" />
                                )}
                                {abilities.approve && (
                                    <PostButton href={approve.url(financing.id)} label="Approve" />
                                )}
                                {abilities.cancel && (
                                    <PostButton href={cancel.url(financing.id)} label="Cancel application" />
                                )}
                            </div>
                            {abilities.reject && (
                                <ReasonForm
                                    action={reject.url(financing.id)}
                                    field="reason"
                                    label="Reject"
                                    placeholder="Reason for rejection"
                                />
                            )}
                        </CardContent>
                    </Card>
                )}

                {abilities.disburse && (
                    <DisburseForm financingId={financing.id} today={today} />
                )}
                {abilities.repay && (
                    <RepaymentForm financingId={financing.id} today={today} />
                )}
                {abilities.default && (
                    <Card className="shadow-none">
                        <CardHeader>
                            <CardTitle>Default</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ReasonForm
                                action={defaultMethod.url(financing.id)}
                                field="reason"
                                label="Mark in default"
                                placeholder="Reason for default"
                            />
                        </CardContent>
                    </Card>
                )}
                {abilities.adjust && (
                    <AdjustmentForm
                        financingId={financing.id}
                        today={today}
                        components={components}
                        directions={directions}
                    />
                )}

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Ledger</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {transactions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No transactions posted.
                            </p>
                        ) : (
                            transactions.map((transaction) => (
                                <article
                                    key={transaction.id}
                                    className="grid gap-3 border-b pb-4 last:border-b-0 last:pb-0"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="font-medium">
                                                {transaction.type_label} · {transaction.amount}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {transaction.reference} · {transaction.occurred_on} · {transaction.component} · {transaction.direction}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {transaction.reconciliation}
                                                {transaction.recorded_by ? ` · ${transaction.recorded_by}` : ''}
                                                {transaction.external_reference ? ` · ${transaction.external_reference}` : ''}
                                            </p>
                                            {transaction.notes && (
                                                <p className="text-sm">{transaction.notes}</p>
                                            )}
                                        </div>
                                        {transaction.can_reconcile && (
                                            <ReconcileButton
                                                financingId={financing.id}
                                                transactionId={transaction.id}
                                            />
                                        )}
                                    </div>
                                    {transaction.can_reverse && (
                                        <ReverseForm
                                            financingId={financing.id}
                                            transactionId={transaction.id}
                                            today={today}
                                        />
                                    )}
                                </article>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>Documents</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        {documents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No documents stored.
                            </p>
                        ) : (
                            <ul className="grid gap-2">
                                {documents.map((document) => (
                                    <li key={document.id}>
                                        <a
                                            href={downloadDocument.url({
                                                financing: financing.id,
                                                document: document.id,
                                            })}
                                            className="text-sm font-medium underline-offset-4 hover:underline"
                                        >
                                            {document.name}
                                        </a>
                                        <p className="text-xs text-muted-foreground">
                                            {document.uploaded_at}
                                            {document.uploaded_by ? ` · ${document.uploaded_by}` : ''}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {abilities.upload && (
                            <DocumentForm financingId={financing.id} />
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader>
                        <CardTitle>History</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        {history.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No decision history yet.
                            </p>
                        ) : (
                            history.map((event) => (
                                <div key={event.id} className="grid gap-1">
                                    <p className="text-sm font-medium">
                                        {event.action} · {event.at}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {event.actor}
                                        {event.detail ? ` · ${event.detail}` : ''}
                                    </p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <Card className="shadow-none">
            <CardHeader>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {label}
                </p>
                <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
            </CardHeader>
        </Card>
    );
}

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

function PostButton({ href, label }: { href: string; label: string }) {
    const form = useForm({});

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(href);
    }

    return (
        <form onSubmit={submit}>
            <Button type="submit" disabled={form.processing}>
                {label}
            </Button>
        </form>
    );
}

function ReasonForm({
    action,
    field,
    label,
    placeholder,
}: {
    action: string;
    field: string;
    label: string;
    placeholder: string;
}) {
    const form = useForm({ [field]: '' });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(action);
    }

    return (
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input
                value={String(form.data[field] ?? '')}
                placeholder={placeholder}
                onChange={(event) => form.setData(field, event.target.value)}
            />
            <Button type="submit" variant="outline" disabled={form.processing}>
                {label}
            </Button>
            <InputError message={form.errors[field]} />
        </form>
    );
}

function DisburseForm({ financingId, today }: { financingId: number; today: string }) {
    const [token] = useState(() => clientToken());
    const form = useForm({
        occurred_on: today,
        disbursement_reference: '',
        notes: '',
        client_token: token,
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(disburse.url(financingId));
    }

    return (
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle>Disburse</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                    <Field label="Disbursement date" error={form.errors.occurred_on}>
                        <Input
                            type="date"
                            value={form.data.occurred_on}
                            onChange={(event) => form.setData('occurred_on', event.target.value)}
                        />
                    </Field>
                    <Field label="Reference" error={form.errors.disbursement_reference}>
                        <Input
                            value={form.data.disbursement_reference}
                            onChange={(event) => form.setData('disbursement_reference', event.target.value)}
                        />
                    </Field>
                    <div className="sm:col-span-2">
                        <Button type="submit" disabled={form.processing}>
                            Post disbursement
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function RepaymentForm({ financingId, today }: { financingId: number; today: string }) {
    const [token] = useState(() => clientToken());
    const form = useForm({
        occurred_on: today,
        amount: '',
        principal_amount: '',
        interest_amount: '0',
        fee_amount: '0',
        payment_method: '',
        external_reference: '',
        notes: '',
        client_token: token,
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(storeRepayment.url(financingId));
    }

    return (
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle>Record repayment</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                        Recording a payment does not mark it reconciled.
                    </p>
                    <Field label="Payment date" error={form.errors.occurred_on}>
                        <Input type="date" value={form.data.occurred_on} onChange={(event) => form.setData('occurred_on', event.target.value)} />
                    </Field>
                    <Field label="Amount received" error={form.errors.amount}>
                        <Input
                            inputMode="decimal"
                            value={form.data.amount}
                            onChange={(event) =>
                                form.setData({
                                    ...form.data,
                                    amount: event.target.value,
                                    principal_amount: event.target.value,
                                })
                            }
                        />
                    </Field>
                    <Field label="Principal" error={form.errors.principal_amount}>
                        <Input inputMode="decimal" value={form.data.principal_amount} onChange={(event) => form.setData('principal_amount', event.target.value)} />
                    </Field>
                    <Field label="Interest" error={form.errors.interest_amount}>
                        <Input inputMode="decimal" value={form.data.interest_amount} onChange={(event) => form.setData('interest_amount', event.target.value)} />
                    </Field>
                    <Field label="Fee" error={form.errors.fee_amount}>
                        <Input inputMode="decimal" value={form.data.fee_amount} onChange={(event) => form.setData('fee_amount', event.target.value)} />
                    </Field>
                    <Field label="Method" error={form.errors.payment_method}>
                        <Input value={form.data.payment_method} onChange={(event) => form.setData('payment_method', event.target.value)} />
                    </Field>
                    <Field label="Receipt reference" error={form.errors.external_reference}>
                        <Input value={form.data.external_reference} onChange={(event) => form.setData('external_reference', event.target.value)} />
                    </Field>
                    <div className="sm:col-span-2">
                        <Button type="submit" disabled={form.processing}>Record payment</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function AdjustmentForm({
    financingId,
    today,
    components,
    directions,
}: {
    financingId: number;
    today: string;
    components: Choice[];
    directions: Choice[];
}) {
    const [token] = useState(() => clientToken());
    const form = useForm({
        occurred_on: today,
        amount: '',
        component: components[0]?.value ?? 'principal',
        direction: 'decrease',
        notes: '',
        client_token: token,
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(storeAdjustment.url(financingId));
    }

    return (
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle>Adjustment</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
                    <Field label="Date" error={form.errors.occurred_on}>
                        <Input type="date" value={form.data.occurred_on} onChange={(event) => form.setData('occurred_on', event.target.value)} />
                    </Field>
                    <Field label="Amount" error={form.errors.amount}>
                        <Input inputMode="decimal" value={form.data.amount} onChange={(event) => form.setData('amount', event.target.value)} />
                    </Field>
                    <Field label="Component" error={form.errors.component}>
                        <select className={selectClassName} value={form.data.component} onChange={(event) => form.setData('component', event.target.value)}>
                            {components.map((component) => (
                                <option key={component.value} value={component.value}>{component.label}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Effect" error={form.errors.direction}>
                        <select className={selectClassName} value={form.data.direction} onChange={(event) => form.setData('direction', event.target.value)}>
                            {directions.map((direction) => (
                                <option key={direction.value} value={direction.value}>{direction.label}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Note" error={form.errors.notes}>
                        <Input value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} />
                    </Field>
                    <div className="sm:col-span-2">
                        <Button type="submit" variant="outline" disabled={form.processing}>Post adjustment</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function ReverseForm({
    financingId,
    transactionId,
    today,
}: {
    financingId: number;
    transactionId: number;
    today: string;
}) {
    const [token] = useState(() => clientToken());
    const form = useForm({
        occurred_on: today,
        notes: '',
        client_token: token,
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(reverse.url({ financing: financingId, transaction: transactionId }));
    }

    return (
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <Input type="date" value={form.data.occurred_on} onChange={(event) => form.setData('occurred_on', event.target.value)} aria-label="Reversal date" />
            <Input value={form.data.notes} placeholder="Reason for reversal" onChange={(event) => form.setData('notes', event.target.value)} />
            <Button type="submit" variant="outline" disabled={form.processing}>Reverse</Button>
            <InputError message={form.errors.notes || form.errors.occurred_on} />
        </form>
    );
}

function ReconcileButton({
    financingId,
    transactionId,
}: {
    financingId: number;
    transactionId: number;
}) {
    const form = useForm({});

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(reconcile.url({ financing: financingId, transaction: transactionId }));
    }

    return (
        <form onSubmit={submit}>
            <Button type="submit" variant="outline" size="sm" disabled={form.processing}>
                Mark reconciled
            </Button>
        </form>
    );
}

function DocumentForm({ financingId }: { financingId: number }) {
    const form = useForm<{ document: File | null }>({ document: null });

    function submit(event: FormEvent) {
        event.preventDefault();
        form.post(storeDocument.url(financingId), { forceFormData: true });
    }

    return (
        <form onSubmit={submit} className="grid gap-2">
            <Label htmlFor="document">Upload a private document</Label>
            <Input
                id="document"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(event) => form.setData('document', event.target.files?.[0] ?? null)}
            />
            <InputError message={form.errors.document} />
            <Button type="submit" variant="outline" disabled={form.processing || form.data.document === null}>
                Upload
            </Button>
        </form>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}
