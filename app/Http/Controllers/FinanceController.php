<?php

namespace App\Http\Controllers;

use App\AccessEventAction;
use App\Actions\ApproveFinancing;
use App\Actions\CancelFinancing;
use App\Actions\DefaultFinancing;
use App\Actions\DisburseFinancing;
use App\Actions\ReconcileFinancingTransaction;
use App\Actions\RecordAccessEvent;
use App\Actions\RecordFinancingAdjustment;
use App\Actions\RecordFinancingRepayment;
use App\Actions\RejectFinancing;
use App\Actions\ReverseFinancingTransaction;
use App\Actions\StartFinancingReview;
use App\Actions\StoreFinancingDocument;
use App\Actions\SubmitFinancingApplication;
use App\FinancingComponent;
use App\FinancingDirection;
use App\FinancingInterestMethod;
use App\FinancingRepaymentFrequency;
use App\FinancingStatus;
use App\FinancingTransactionType;
use App\FinancingType;
use App\Http\Requests\DefaultFinancingRequest;
use App\Http\Requests\DisburseFinancingRequest;
use App\Http\Requests\FinanceIndexRequest;
use App\Http\Requests\RecordFinancingAdjustmentRequest;
use App\Http\Requests\RecordFinancingRepaymentRequest;
use App\Http\Requests\RejectFinancingRequest;
use App\Http\Requests\ReverseFinancingTransactionRequest;
use App\Http\Requests\StoreFinancingApplicationRequest;
use App\Http\Requests\StoreFinancingDocumentRequest;
use App\Models\AccessEvent;
use App\Models\Farm;
use App\Models\Farmer;
use App\Models\FarmFinancing;
use App\Models\FarmProduction;
use App\Models\FinancingDocument;
use App\Models\FinancingTransaction;
use App\Models\User;
use App\Services\FinanceSummary;
use App\Services\FinancingAuthorization;
use App\Services\FinancingLedger;
use App\Support\DecimalQuantity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceController extends Controller
{
    public function __construct(
        private FinanceSummary $summary,
        private FinancingLedger $ledger,
        private FinancingAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    public function index(FinanceIndexRequest $request): Response
    {
        $user = $this->actor($request);
        $filters = $this->filters($request);

        $records = $this->agreements($user, $filters)
            ->with(['farm.farmer', 'transactions'])
            ->tap(fn (Builder $query) => $this->sort($query, $filters))
            ->paginate(10)
            ->withQueryString()
            ->through(fn (FarmFinancing $financing): array => $this->row($financing));

        return Inertia::render('finance/index', [
            'summary' => $this->summary->summarize($user, $filters),
            'financings' => $records,
            'filters' => $this->filterProps($filters),
            'statuses' => $this->statusOptions(),
            'farmers' => $this->farmerOptions($user),
            'provinces' => $this->provinces($user),
            'municipalities' => $this->municipalities($user),
            'can_manage' => true,
        ]);
    }

    public function transactions(FinanceIndexRequest $request): Response
    {
        $user = $this->actor($request);
        $filters = $this->filters($request);

        $transactions = FinancingTransaction::query()
            ->whereIn('farm_financing_id', $this->summary->scoped($user, $filters)->select('farm_financings.id'))
            ->with(['financing.farm.farmer', 'recorder:id,name'])
            ->when($filters['from'] !== null, fn (Builder $query) => $query->whereDate('occurred_on', '>=', $filters['from']))
            ->when($filters['to'] !== null, fn (Builder $query) => $query->whereDate('occurred_on', '<=', $filters['to']))
            ->when($filters['search'] !== '', function (Builder $query) use ($filters): void {
                $search = '%'.addcslashes($filters['search'], '%_\\').'%';
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('reference', 'like', $search)
                        ->orWhere('external_reference', 'like', $search)
                        ->orWhereHas('financing', fn (Builder $financing) => $financing->where('reference', 'like', $search));
                });
            })
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (FinancingTransaction $transaction): array => $this->transactionRow($transaction));

        return Inertia::render('finance/transactions', [
            'transactions' => $transactions,
            'filters' => $this->filterProps($filters),
            'farmers' => $this->farmerOptions($user),
            'provinces' => $this->provinces($user),
            'municipalities' => $this->municipalities($user),
        ]);
    }

    public function create(Request $request): Response
    {
        $this->actor($request);
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        return Inertia::render('finance/create', [
            'farms' => $this->farmOptions($user),
            'productions' => $this->productionOptions($user),
            'financingTypes' => $this->enumOptions(FinancingType::cases()),
            'interestMethods' => $this->enumOptions(FinancingInterestMethod::cases()),
            'frequencies' => $this->enumOptions(FinancingRepaymentFrequency::cases()),
            'selectedFarmId' => $request->integer('farm') ?: null,
            'today' => now()->toDateString(),
        ]);
    }

    public function store(StoreFinancingApplicationRequest $request, SubmitFinancingApplication $submit): RedirectResponse
    {
        $user = $this->actor($request);
        $farm = Farm::query()->findOrFail($request->integer('farm_id'));
        $financing = $submit->handle($farm, $request->validated(), $user);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Financing application '.$financing->reference.' saved.',
        ]);

        return to_route('finance.show', $financing);
    }

    public function show(Request $request, FarmFinancing $financing): Response
    {
        $user = $this->actor($request);
        $financing->load([
            'farm.farmer',
            'production',
            'submitter:id,name',
            'approver:id,name',
            'transactions.recorder:id,name',
            'documents.uploader:id,name',
        ]);

        $position = $financing->usesLedger()
            ? $this->ledger->outstandingCents($financing)
            : null;

        return Inertia::render('finance/show', [
            'financing' => $this->detail($financing, $position),
            'transactions' => $financing->transactions
                ->sortByDesc(fn (FinancingTransaction $transaction): string => $transaction->occurred_on->toDateString().'-'.$transaction->id)
                ->values()
                ->map(fn (FinancingTransaction $transaction): array => [
                    ...$this->transactionRow($transaction),
                    'can_reverse' => $this->authorization->canReverse($user, $financing, $transaction),
                    'can_reconcile' => $this->authorization->canReconcile($user, $financing, $transaction),
                    'notes' => $transaction->notes,
                    'payment_method' => $transaction->payment_method,
                    'external_reference' => $transaction->external_reference,
                    'recorded_by' => $transaction->recorder?->name,
                ])
                ->all(),
            'documents' => $financing->documents
                ->sortByDesc('id')
                ->values()
                ->map(fn (FinancingDocument $document): array => [
                    'id' => $document->id,
                    'name' => $document->original_name,
                    'uploaded_at' => $document->created_at->format('m/d/Y'),
                    'uploaded_by' => $document->uploader?->name,
                ])
                ->all(),
            'history' => $this->history($financing),
            'abilities' => $this->authorization->abilities($user, $financing),
            'components' => $this->enumOptions(FinancingComponent::cases()),
            'directions' => $this->enumOptions(FinancingDirection::cases()),
            'today' => now()->toDateString(),
        ]);
    }

    public function review(Request $request, FarmFinancing $financing, StartFinancingReview $review): RedirectResponse
    {
        $review->handle($financing, $this->actor($request));

        return $this->back($financing, 'Application moved to review.');
    }

    public function approve(Request $request, FarmFinancing $financing, ApproveFinancing $approve): RedirectResponse
    {
        $approve->handle($financing, $this->actor($request));

        return $this->back($financing, 'Financing application approved.');
    }

    public function reject(RejectFinancingRequest $request, FarmFinancing $financing, RejectFinancing $reject): RedirectResponse
    {
        $reject->handle($financing, $request->validated(), $this->actor($request));

        return $this->back($financing, 'Financing application rejected.');
    }

    public function cancel(Request $request, FarmFinancing $financing, CancelFinancing $cancel): RedirectResponse
    {
        $cancel->handle($financing, $this->actor($request));

        return $this->back($financing, 'Financing application cancelled.');
    }

    public function disburse(DisburseFinancingRequest $request, FarmFinancing $financing, DisburseFinancing $disburse): RedirectResponse
    {
        $disburse->handle($financing, $request->validated(), $this->actor($request));

        return $this->back($financing, 'Financing disbursed and posted to the ledger.');
    }

    public function repay(RecordFinancingRepaymentRequest $request, FarmFinancing $financing, RecordFinancingRepayment $repay): RedirectResponse
    {
        $repay->handle($financing, $request->validated(), $this->actor($request));

        return $this->back($financing, 'Repayment recorded. It stays unreconciled until it is checked.');
    }

    public function default(DefaultFinancingRequest $request, FarmFinancing $financing, DefaultFinancing $default): RedirectResponse
    {
        $default->handle($financing, $request->validated(), $this->actor($request));

        return $this->back($financing, 'Agreement marked in default.');
    }

    public function adjust(RecordFinancingAdjustmentRequest $request, FarmFinancing $financing, RecordFinancingAdjustment $adjust): RedirectResponse
    {
        $adjust->handle($financing, $request->validated(), $this->actor($request));

        return $this->back($financing, 'Adjustment posted. The original transactions were left unchanged.');
    }

    public function reverse(
        ReverseFinancingTransactionRequest $request,
        FarmFinancing $financing,
        FinancingTransaction $transaction,
        ReverseFinancingTransaction $reverse,
    ): RedirectResponse {
        abort_unless((int) $transaction->farm_financing_id === (int) $financing->id, 404);
        $reverse->handle($financing, $transaction, $request->validated(), $this->actor($request));

        return $this->back($financing, 'Reversal posted. The original transaction is still on the ledger.');
    }

    public function reconcile(
        Request $request,
        FarmFinancing $financing,
        FinancingTransaction $transaction,
        ReconcileFinancingTransaction $reconcile,
    ): RedirectResponse {
        abort_unless((int) $transaction->farm_financing_id === (int) $financing->id, 404);
        $reconcile->handle($financing, $transaction, $this->actor($request));

        return $this->back($financing, 'Transaction marked reconciled.');
    }

    public function storeDocument(
        StoreFinancingDocumentRequest $request,
        FarmFinancing $financing,
        StoreFinancingDocument $store,
    ): RedirectResponse {
        $file = $request->file('document');

        if (! $file instanceof UploadedFile) {
            abort(422);
        }

        $store->handle($financing, $file, $this->actor($request));

        return $this->back($financing, 'Document stored.');
    }

    public function document(Request $request, FarmFinancing $financing, FinancingDocument $document): StreamedResponse
    {
        $this->actor($request);
        abort_unless((int) $document->farm_financing_id === (int) $financing->id, 404);

        return Storage::disk('local')->response($document->path, $document->original_name);
    }

    public function export(FinanceIndexRequest $request): StreamedResponse
    {
        $user = $this->actor($request);
        $filters = $this->filters($request);
        $query = $this->agreements($user, $filters)->with(['farm.farmer', 'transactions']);
        $count = (clone $query)->count();

        $this->accessEvents->handle($user, AccessEventAction::FinancingExported, null, null, [
            'rows' => $count,
            'status' => $filters['status'] ?? '',
            'from' => $filters['from'] ?? '',
            'to' => $filters['to'] ?? '',
            'province' => $filters['province'] ?? '',
            'municipality' => $filters['municipality'] ?? '',
            'farmer_id' => $filters['farmer_id'] ?? '',
            'queue' => $filters['queue'] ?? '',
        ]);

        $filename = 'finance-'.now()->toDateString().'.csv';

        return response()->streamDownload(function () use ($query): void {
            $handle = fopen('php://output', 'w');

            if ($handle === false) {
                return;
            }

            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, [
                'Reference',
                'Status',
                'Balance source',
                'Farmer',
                'Farm',
                'Farm ID',
                'Province',
                'Municipality',
                'Type',
                'Currency',
                'Principal',
                'Outstanding principal',
                'Outstanding interest',
                'Outstanding fees',
                'Due date',
                'Application date',
                'Disbursed on',
            ]);

            $query->orderBy('id')->lazy(200)->each(function (FarmFinancing $financing) use ($handle): void {
                $row = $this->row($financing);
                fputcsv($handle, [
                    $this->csv($row['reference']),
                    $this->csv($row['status_label']),
                    $this->csv($row['balance_source_label']),
                    $this->csv($row['farmer_name']),
                    $this->csv($row['farm_name']),
                    $this->csv($row['farm_code']),
                    $this->csv((string) $row['province']),
                    $this->csv((string) $row['municipality']),
                    $this->csv($row['type_label']),
                    $row['currency'],
                    $row['principal_amount'],
                    $row['outstanding_principal_amount'],
                    $row['outstanding_interest_amount'],
                    $row['outstanding_fee_amount'],
                    $row['due_date'],
                    $row['application_date'],
                    $row['date_granted'],
                ]);
            });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @param  array{
     *     search: string,
     *     status: string|null,
     *     farmer_id: int|null,
     *     province: string|null,
     *     municipality: string|null,
     *     from: string|null,
     *     to: string|null,
     *     as_of: string,
     *     queue: string|null,
     *     sort: string|null,
     *     direction: string|null
     * }  $filters
     * @return Builder<FarmFinancing>
     */
    private function agreements(User $user, array $filters): Builder
    {
        return $this->summary->scoped($user, $filters)
            ->when($filters['status'] !== null, fn (Builder $query) => $query->where('status', $filters['status']))
            ->when($filters['queue'] === 'review', fn (Builder $query) => $query->whereIn('status', [
                FinancingStatus::Submitted->value,
                FinancingStatus::UnderReview->value,
            ]))
            ->when($filters['queue'] === 'due', function (Builder $query): void {
                $query->whereIn('status', [FinancingStatus::Disbursed->value, FinancingStatus::Defaulted->value])
                    ->whereDate('due_date', '>=', now()->toDateString())
                    ->whereDate('due_date', '<=', now()->addDays(FinancingLedger::DUE_SOON_DAYS)->toDateString());
            })
            ->when($filters['queue'] === 'overdue', function (Builder $query): void {
                $query->whereIn('status', [FinancingStatus::Disbursed->value, FinancingStatus::Defaulted->value])
                    ->whereDate('due_date', '<', now()->toDateString());
            })
            ->when($filters['search'] !== '', function (Builder $query) use ($filters): void {
                $search = '%'.addcslashes($filters['search'], '%_\\').'%';
                $query->where(function (Builder $query) use ($search): void {
                    $query->where('reference', 'like', $search)
                        ->orWhere('disbursement_reference', 'like', $search)
                        ->orWhere('purpose', 'like', $search)
                        ->orWhereHas('farm', function (Builder $farm) use ($search): void {
                            $farm->where('farm_id', 'like', $search)
                                ->orWhere('farm_name', 'like', $search)
                                ->orWhereHas('farmer', function (Builder $farmer) use ($search): void {
                                    $farmer->where('first_name', 'like', $search)
                                        ->orWhere('last_name', 'like', $search)
                                        ->orWhere('farmer_id', 'like', $search);
                                });
                        });
                });
            });
    }

    /**
     * @param  Builder<FarmFinancing>  $query
     * @param  array{sort: string|null, direction: string|null, queue: string|null, ...}  $filters
     */
    private function sort(Builder $query, array $filters): void
    {
        $columns = [
            'reference' => 'reference',
            'status' => 'status',
            'amount' => 'amount',
            'due_date' => 'due_date',
            'application_date' => 'application_date',
            'date_granted' => 'date_granted',
        ];
        $column = $columns[$filters['sort']] ?? 'id';
        $direction = $filters['direction'] === 'asc' ? 'asc' : 'desc';

        if ($filters['sort'] === null && $filters['queue'] === 'due') {
            $query->orderBy('due_date')->orderBy('id');

            return;
        }

        if ($filters['sort'] === null && $filters['queue'] === 'overdue') {
            $query->orderBy('due_date')->orderByDesc('id');

            return;
        }

        $query->orderBy($column, $direction)->orderByDesc('id');
    }

    /**
     * @return array{
     *     search: string,
     *     status: string|null,
     *     farmer_id: int|null,
     *     province: string|null,
     *     municipality: string|null,
     *     from: string|null,
     *     to: string|null,
     *     as_of: string,
     *     queue: string|null,
     *     sort: string|null,
     *     direction: string|null
     * }
     */
    private function filters(FinanceIndexRequest $request): array
    {
        $asOf = $request->string('as_of')->toString();

        return [
            'search' => $request->string('search')->toString(),
            'status' => $request->string('status')->toString() ?: null,
            'farmer_id' => $request->integer('farmer') ?: null,
            'province' => $request->string('province')->toString() ?: null,
            'municipality' => $request->string('municipality')->toString() ?: null,
            'from' => $request->string('from')->toString() ?: null,
            'to' => $request->string('to')->toString() ?: null,
            'as_of' => $asOf !== '' ? $asOf : now()->toDateString(),
            'queue' => $request->string('queue')->toString() ?: null,
            'sort' => $request->string('sort')->toString() ?: null,
            'direction' => $request->string('direction')->toString() ?: null,
        ];
    }

    /**
     * @param  array{
     *     search: string,
     *     status: string|null,
     *     farmer_id: int|null,
     *     province: string|null,
     *     municipality: string|null,
     *     from: string|null,
     *     to: string|null,
     *     as_of: string,
     *     queue: string|null,
     *     sort: string|null,
     *     direction: string|null
     * }  $filters
     * @return array<string, string>
     */
    private function filterProps(array $filters): array
    {
        return [
            'search' => (string) $filters['search'],
            'status' => (string) ($filters['status'] ?? ''),
            'farmer' => $filters['farmer_id'] === null ? '' : (string) $filters['farmer_id'],
            'province' => (string) ($filters['province'] ?? ''),
            'municipality' => (string) ($filters['municipality'] ?? ''),
            'from' => (string) ($filters['from'] ?? ''),
            'to' => (string) ($filters['to'] ?? ''),
            'as_of' => (string) $filters['as_of'],
            'queue' => (string) ($filters['queue'] ?? ''),
            'sort' => (string) ($filters['sort'] ?? ''),
            'direction' => (string) ($filters['direction'] ?? ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function row(FarmFinancing $financing): array
    {
        $position = $financing->usesLedger() ? $this->ledger->outstandingCents($financing) : null;

        return [
            'id' => $financing->id,
            'reference' => $financing->reference ?? '—',
            'farmer_name' => $financing->farm->farmer->fullName(),
            'farm_name' => $financing->farm->displayName(),
            'farm_code' => $financing->farm->farm_id,
            'province' => $financing->farm->province ?? '—',
            'municipality' => $financing->farm->municipality ?? '—',
            'status' => $financing->status->value,
            'status_label' => $financing->status->label(),
            'balance_source' => $financing->balance_source->value,
            'balance_source_label' => $financing->balance_source->label(),
            'type_label' => $financing->financing_type->label(),
            'currency' => $financing->currency ?: 'PHP',
            'principal' => $financing->money($financing->amount),
            'principal_amount' => $financing->amount ?? '',
            'outstanding_principal' => $position === null
                ? $financing->money($financing->loan_balance)
                : $this->ledger->money($financing->currency ?: 'PHP', $position['principal']),
            'outstanding_principal_amount' => $position === null
                ? ($financing->loan_balance ?? '')
                : DecimalQuantity::fromCents($position['principal']),
            'outstanding_interest' => $position === null
                ? '—'
                : $this->ledger->money($financing->currency ?: 'PHP', $position['interest']),
            'outstanding_interest_amount' => $position === null ? '' : DecimalQuantity::fromCents($position['interest']),
            'outstanding_fees' => $position === null
                ? '—'
                : $this->ledger->money($financing->currency ?: 'PHP', $position['fee']),
            'outstanding_fee_amount' => $position === null ? '' : DecimalQuantity::fromCents($position['fee']),
            'due_date' => $financing->due_date?->format('m/d/Y') ?? '—',
            'application_date' => $financing->application_date?->format('m/d/Y') ?? '—',
            'date_granted' => $financing->date_granted?->format('m/d/Y') ?? '—',
        ];
    }

    /**
     * @param  array{principal: int, interest: int, fee: int}|null  $position
     * @return array<string, mixed>
     */
    private function detail(FarmFinancing $financing, ?array $position): array
    {
        $currency = $financing->currency ?: 'PHP';

        return [
            'id' => $financing->id,
            'reference' => $financing->reference ?? '—',
            'farm_record_id' => $financing->farm_id,
            'farm_code' => $financing->farm->farm_id,
            'farm_name' => $financing->farm->displayName(),
            'farmer_name' => $financing->farm->farmer->fullName(),
            'farmer_code' => $financing->farm->farmer->farmer_id,
            'province' => $financing->farm->province,
            'municipality' => $financing->farm->municipality,
            'production' => $financing->production === null
                ? null
                : trim($financing->production->cropLabel().' '.$financing->production->production_period),
            'purpose' => $financing->purpose,
            'type_label' => $financing->financing_type->label(),
            'status' => $financing->status->value,
            'status_label' => $financing->status->label(),
            'balance_source' => $financing->balance_source->value,
            'balance_source_label' => $financing->balance_source->label(),
            'currency' => $currency,
            'principal' => $financing->money($financing->amount),
            'interest_method' => $financing->interest_method->label(),
            'interest_rate' => $financing->interest_rate,
            'interest_amount' => $financing->usesLedger() ? $financing->money($financing->interest_amount) : '—',
            'fee_amount' => $financing->usesLedger() ? $financing->money($financing->fee_amount) : '—',
            'outstanding_principal' => $position === null ? $financing->money($financing->loan_balance) : $this->ledger->money($currency, $position['principal']),
            'outstanding_interest' => $position === null ? '—' : $this->ledger->money($currency, $position['interest']),
            'outstanding_fees' => $position === null ? '—' : $this->ledger->money($currency, $position['fee']),
            'total_due' => $position === null ? '—' : $this->ledger->money($currency, $this->ledger->totalDueCents($position)),
            'application_date' => $financing->application_date?->format('m/d/Y') ?? '—',
            'date_granted' => $financing->date_granted?->format('m/d/Y') ?? '—',
            'due_date' => $financing->due_date?->format('Y-m-d') ?? '',
            'due_date_label' => $financing->due_date?->format('m/d/Y') ?? '—',
            'maturity_date' => $financing->maturity_date?->format('m/d/Y') ?? '—',
            'frequency' => $financing->repayment_frequency?->label() ?? '—',
            'installment_count' => $financing->installment_count,
            'disbursement_reference' => $financing->disbursement_reference,
            'notes' => $financing->notes,
            'rejection_reason' => $financing->rejection_reason,
            'default_reason' => $financing->default_reason,
            'submitted_by' => $financing->submitter?->name,
            'approved_by' => $financing->approver?->name,
            'approved_at' => $financing->approved_at?->format('m/d/Y g:i A'),
            'uses_ledger' => $financing->usesLedger(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function transactionRow(FinancingTransaction $transaction): array
    {
        $financing = $transaction->financing;

        return [
            'id' => $transaction->id,
            'financing_id' => $transaction->farm_financing_id,
            'financing_reference' => $financing->reference ?? '—',
            'reference' => $transaction->reference ?? '—',
            'type' => $transaction->type->value,
            'type_label' => $transaction->type->label(),
            'component' => $transaction->component->label(),
            'direction' => $transaction->direction->label(),
            'amount' => $financing->money($transaction->amount),
            'occurred_on' => $transaction->occurred_on->format('m/d/Y'),
            'reconciliation' => $transaction->reconciliation_status->label(),
            'reversed' => $transaction->type === FinancingTransactionType::Reversal,
        ];
    }

    /**
     * @return list<array{id: int, action: string, actor: string, at: string, detail: string}>
     */
    private function history(FarmFinancing $financing): array
    {
        $events = AccessEvent::query()
            ->where('auditable_type', $financing->getMorphClass())
            ->where('auditable_id', $financing->id)
            ->with('actor:id,name')
            ->orderByDesc('id')
            ->limit(40)
            ->get()
            ->map(function (AccessEvent $event): array {
                $detail = collect($event->metadata ?? [])
                    ->map(fn (mixed $value, string $key): string => $key.': '.(is_scalar($value) ? (string) $value : ''))
                    ->implode(' · ');

                return [
                    'id' => $event->id,
                    'action' => $this->eventLabel($event->action),
                    'actor' => $event->actor_id === null ? 'Unknown user' : $event->actor->name,
                    'at' => $event->created_at->format('m/d/Y g:i A'),
                    'detail' => $detail,
                ];
            })
            ->all();

        return array_values($events);
    }

    private function eventLabel(AccessEventAction $action): string
    {
        return match ($action) {
            AccessEventAction::FinancingSubmitted => 'Application submitted',
            AccessEventAction::FinancingReviewStarted => 'Review started',
            AccessEventAction::FinancingApproved => 'Approved',
            AccessEventAction::FinancingRejected => 'Rejected',
            AccessEventAction::FinancingCancelled => 'Cancelled',
            AccessEventAction::FinancingDisbursed => 'Disbursed',
            AccessEventAction::FinancingRepaymentRecorded => 'Repayment recorded',
            AccessEventAction::FinancingAdjusted => 'Adjustment posted',
            AccessEventAction::FinancingReversed => 'Transaction reversed',
            AccessEventAction::FinancingReconciled => 'Transaction reconciled',
            AccessEventAction::FinancingDefaulted => 'Marked in default',
            AccessEventAction::FinancingCompleted => 'Completed',
            AccessEventAction::FinancingExported => 'Exported',
            default => $action->value,
        };
    }

    /**
     * @param  list<\BackedEnum>  $cases
     * @return list<array{value: string, label: string}>
     */
    private function enumOptions(array $cases): array
    {
        return array_map(fn (\BackedEnum $case): array => [
            'value' => (string) $case->value,
            'label' => method_exists($case, 'label') ? $case->label() : (string) $case->value,
        ], $cases);
    }

    /**
     * @return list<array{value: string, label: string}>
     */
    private function statusOptions(): array
    {
        return $this->enumOptions(FinancingStatus::cases());
    }

    /**
     * @return list<array{id: int, farm_id: string, farm_name: string, farmer_name: string}>
     */
    private function farmOptions(User $user): array
    {
        $farms = Farm::query()
            ->visibleTo($user)
            ->with('farmer:id,first_name,middle_name,last_name,suffix')
            ->orderBy('farm_name')
            ->orderBy('id')
            ->get()
            ->map(fn (Farm $farm): array => [
                'id' => $farm->id,
                'farm_id' => $farm->farm_id,
                'farm_name' => $farm->displayName(),
                'farmer_name' => $farm->farmer->fullName(),
            ])
            ->all();

        return array_values($farms);
    }

    /**
     * @return list<array{id: int, farm_id: int, label: string}>
     */
    private function productionOptions(User $user): array
    {
        $productions = FarmProduction::query()
            ->visibleTo($user)
            ->orderByDesc('id')
            ->get()
            ->map(fn (FarmProduction $production): array => [
                'id' => $production->id,
                'farm_id' => $production->farm_id,
                'label' => trim($production->cropLabel().' '.($production->production_period ?? '')),
            ])
            ->all();

        return array_values($productions);
    }

    /**
     * @return list<array{id: int, name: string}>
     */
    private function farmerOptions(User $user): array
    {
        $farmers = Farmer::query()
            ->visibleTo($user)
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'middle_name', 'last_name', 'suffix'])
            ->map(fn (Farmer $farmer): array => [
                'id' => $farmer->id,
                'name' => $farmer->fullName(),
            ])
            ->all();

        return array_values($farmers);
    }

    /**
     * @return list<string>
     */
    private function provinces(User $user): array
    {
        $provinces = Farm::query()
            ->visibleTo($user)
            ->whereNotNull('province')
            ->distinct()
            ->orderBy('province')
            ->pluck('province')
            ->filter(fn (mixed $province): bool => is_string($province) && $province !== '')
            ->all();

        return array_values($provinces);
    }

    /**
     * @return list<string>
     */
    private function municipalities(User $user): array
    {
        $municipalities = Farm::query()
            ->visibleTo($user)
            ->whereNotNull('municipality')
            ->distinct()
            ->orderBy('municipality')
            ->pluck('municipality')
            ->filter(fn (mixed $municipality): bool => is_string($municipality) && $municipality !== '')
            ->all();

        return array_values($municipalities);
    }

    private function actor(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 403);

        return $user;
    }

    private function back(FarmFinancing $financing, string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'success', 'message' => $message]);

        return to_route('finance.show', $financing);
    }

    private function csv(string $value): string
    {
        if (preg_match('/^[=+\-@]/', $value) === 1) {
            return "'".$value;
        }

        return $value;
    }
}
