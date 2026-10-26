<?php

namespace App\Services;

use App\AccessEventAction;
use App\Actions\RecordAccessEvent;
use App\InsurancePolicyStatus;
use App\Models\AccessEvent;
use App\Models\Farm;
use App\Models\FarmInsurance;
use App\Models\FarmProduction;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InsurancePolicies
{
    public function __construct(
        private InsuranceAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function submit(Farm $farm, array $data, User $actor): FarmInsurance
    {
        if (! $this->authorization->manage($actor)) {
            abort(403);
        }

        $existing = FarmInsurance::query()->where('client_token', $data['client_token'])->first();

        if ($existing instanceof FarmInsurance) {
            $this->assertSamePolicy($existing, $farm, $data);

            return $existing;
        }

        $productionId = $data['farm_production_id'] ?? null;

        if ($productionId !== null) {
            $belongs = FarmProduction::query()
                ->whereKey($productionId)
                ->where('farm_id', $farm->id)
                ->exists();

            if (! $belongs) {
                throw ValidationException::withMessages([
                    'farm_production_id' => 'Choose a crop cycle from this farm.',
                ]);
            }
        }

        try {
            return DB::transaction(function () use ($farm, $data, $actor, $productionId): FarmInsurance {
                $policy = FarmInsurance::query()->create([
                    'farm_id' => $farm->id,
                    'farm_production_id' => $productionId,
                    'submitted_by' => $actor->id,
                    'covered' => false,
                    'amount' => $data['amount'],
                    'provider' => $data['provider'],
                    'policy_type' => $data['policy_type'],
                    'currency' => $data['currency'],
                    'insured_area' => $data['insured_area'] ?? null,
                    'premium_amount' => $data['premium_amount'] ?? 0,
                    'coverage_start' => $data['coverage_start'],
                    'coverage_end' => $data['coverage_end'],
                    'terms' => $data['terms'] ?? null,
                    'exclusions' => $data['exclusions'] ?? null,
                    'status' => InsurancePolicyStatus::Submitted,
                    'notes' => $data['notes'] ?? null,
                    'client_token' => $data['client_token'],
                ]);

                $this->accessEvents->handle($actor, AccessEventAction::InsuranceSubmitted, null, $policy, [
                    'reference' => $policy->reference,
                    'amount' => (string) $policy->amount,
                    'currency' => $policy->currency,
                ]);

                return $policy;
            });
        } catch (UniqueConstraintViolationException) {
            $existing = FarmInsurance::query()->where('client_token', $data['client_token'])->first();

            if ($existing instanceof FarmInsurance) {
                $this->assertSamePolicy($existing, $farm, $data);

                return $existing;
            }

            throw ValidationException::withMessages([
                'client_token' => 'This application was already submitted.',
            ]);
        }
    }

    public function review(FarmInsurance $policy, User $actor): FarmInsurance
    {
        return DB::transaction(function () use ($policy, $actor): FarmInsurance {
            $locked = FarmInsurance::query()->lockForUpdate()->findOrFail($policy->id);

            if (! $this->authorization->canReviewPolicy($actor, $locked)) {
                abort(403);
            }

            $locked->update([
                'status' => InsurancePolicyStatus::UnderReview,
                'reviewed_at' => now(),
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceReviewStarted, null, $locked, [
                'reference' => $locked->reference,
            ]);

            return $locked;
        });
    }

    public function approve(FarmInsurance $policy, User $actor): FarmInsurance
    {
        return DB::transaction(function () use ($policy, $actor): FarmInsurance {
            $locked = FarmInsurance::query()->lockForUpdate()->findOrFail($policy->id);

            if (! $this->authorization->canApprovePolicy($actor, $locked)) {
                abort(403);
            }

            $locked->update([
                'status' => InsurancePolicyStatus::Approved,
                'approved_at' => now(),
                'approved_by' => $actor->id,
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceApproved, null, $locked, [
                'reference' => $locked->reference,
            ]);

            return $locked;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function reject(FarmInsurance $policy, array $data, User $actor): FarmInsurance
    {
        return DB::transaction(function () use ($policy, $data, $actor): FarmInsurance {
            $locked = FarmInsurance::query()->lockForUpdate()->findOrFail($policy->id);

            if (! $this->authorization->canRejectPolicy($actor, $locked)) {
                abort(403);
            }

            $locked->update([
                'status' => InsurancePolicyStatus::Rejected,
                'rejected_at' => now(),
                'rejected_by' => $actor->id,
                'rejection_reason' => $data['reason'],
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceRejected, null, $locked, [
                'reference' => $locked->reference,
                'reason' => (string) $data['reason'],
            ]);

            return $locked;
        });
    }

    public function cancel(FarmInsurance $policy, User $actor): FarmInsurance
    {
        return DB::transaction(function () use ($policy, $actor): FarmInsurance {
            $locked = FarmInsurance::query()->lockForUpdate()->findOrFail($policy->id);

            if (! $this->authorization->canCancelPolicy($actor, $locked)) {
                abort(403);
            }

            $locked->update([
                'status' => InsurancePolicyStatus::Cancelled,
                'cancelled_at' => now(),
                'cancelled_by' => $actor->id,
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceCancelled, null, $locked, [
                'reference' => $locked->reference,
            ]);

            return $locked;
        });
    }

    public function activate(FarmInsurance $policy, User $actor): FarmInsurance
    {
        return DB::transaction(function () use ($policy, $actor): FarmInsurance {
            $locked = FarmInsurance::query()->lockForUpdate()->findOrFail($policy->id);

            if (! $this->authorization->canActivate($actor, $locked)) {
                abort(403);
            }

            $missing = [];

            if (! is_string($locked->provider) || $locked->provider === '') {
                $missing['provider'] = 'A provider is required before activation.';
            }

            if (! is_string($locked->policy_type) || $locked->policy_type === '') {
                $missing['policy_type'] = 'A policy type is required before activation.';
            }

            if ($locked->coverage_start === null || $locked->coverage_end === null) {
                $missing['coverage_start'] = 'Coverage dates are required before activation.';
            }

            if ($locked->amount === null || (float) $locked->amount <= 0) {
                $missing['amount'] = 'An insured value is required before activation.';
            }

            if (! $locked->documents()->exists()) {
                $missing['document'] = 'Upload the policy document before activation.';
            }

            if ($missing !== []) {
                throw ValidationException::withMessages($missing);
            }

            $locked->update([
                'status' => InsurancePolicyStatus::Active,
                'covered' => true,
                'activated_at' => now(),
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceActivated, null, $locked, [
                'reference' => $locked->reference,
            ]);

            return $locked;
        });
    }

    public function expireDue(User $viewer): void
    {
        FarmInsurance::query()
            ->visibleTo($viewer)
            ->where('status', InsurancePolicyStatus::Active)
            ->whereDate('coverage_end', '<', now()->toDateString())
            ->orderBy('id')
            ->each(function (FarmInsurance $policy): void {
                DB::transaction(function () use ($policy): void {
                    $locked = FarmInsurance::query()->lockForUpdate()->find($policy->id);

                    if (! $locked instanceof FarmInsurance || $locked->status !== InsurancePolicyStatus::Active) {
                        return;
                    }

                    if ($locked->coverage_end === null || $locked->coverage_end->greaterThanOrEqualTo(now()->startOfDay())) {
                        return;
                    }

                    $locked->update(['status' => InsurancePolicyStatus::Expired]);

                    AccessEvent::query()->create([
                        'actor_id' => null,
                        'action' => AccessEventAction::InsuranceExpired,
                        'auditable_type' => $locked->getMorphClass(),
                        'auditable_id' => $locked->id,
                        'metadata' => [
                            'reference' => $locked->reference,
                            'coverage_end' => $locked->coverage_end->toDateString(),
                        ],
                        'created_at' => now(),
                    ]);
                });
            });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertSamePolicy(FarmInsurance $existing, Farm $farm, array $data): void
    {
        $same = (int) $existing->farm_id === (int) $farm->id
            && (string) $existing->amount === number_format((float) $data['amount'], 2, '.', '')
            && $existing->currency === $data['currency'];

        if (! $same) {
            throw ValidationException::withMessages([
                'client_token' => 'This application token was already used for a different policy.',
            ]);
        }
    }
}
