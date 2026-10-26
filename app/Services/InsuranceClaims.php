<?php

namespace App\Services;

use App\AccessEventAction;
use App\Actions\RecordAccessEvent;
use App\InsuranceClaimStatus;
use App\Models\FarmInsurance;
use App\Models\InsuranceClaim;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InsuranceClaims
{
    public function __construct(
        private InsuranceAuthorization $authorization,
        private RecordAccessEvent $accessEvents,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function submit(FarmInsurance $policy, array $data, User $actor): InsuranceClaim
    {
        if (! $this->authorization->canSubmitClaim($actor, $policy)) {
            abort(403);
        }

        $existing = InsuranceClaim::query()->where('client_token', $data['client_token'])->first();

        if ($existing instanceof InsuranceClaim) {
            $this->assertSameClaim($existing, $policy, $data);

            return $existing;
        }

        $this->assertEligible($policy, $data);

        try {
            return DB::transaction(function () use ($policy, $data, $actor): InsuranceClaim {
                $locked = FarmInsurance::query()->lockForUpdate()->findOrFail($policy->id);
                $this->assertEligible($locked, $data);

                $claim = $locked->claims()->create([
                    'incident_date' => $data['incident_date'],
                    'reported_on' => $data['reported_on'],
                    'category' => $data['category'],
                    'description' => $data['description'],
                    'claimed_amount' => $data['claimed_amount'],
                    'currency' => $locked->currency,
                    'status' => InsuranceClaimStatus::Submitted,
                    'submitted_by' => $actor->id,
                    'client_token' => $data['client_token'],
                ]);

                $this->accessEvents->handle($actor, AccessEventAction::InsuranceClaimSubmitted, null, $claim, [
                    'reference' => $claim->reference,
                    'policy' => $locked->reference,
                    'claimed_amount' => (string) $claim->claimed_amount,
                ]);

                return $claim;
            });
        } catch (UniqueConstraintViolationException) {
            $existing = InsuranceClaim::query()->where('client_token', $data['client_token'])->first();

            if ($existing instanceof InsuranceClaim) {
                $this->assertSameClaim($existing, $policy, $data);

                return $existing;
            }

            throw ValidationException::withMessages([
                'client_token' => 'This claim was already submitted.',
            ]);
        }
    }

    public function review(InsuranceClaim $claim, User $actor): InsuranceClaim
    {
        return DB::transaction(function () use ($claim, $actor): InsuranceClaim {
            $locked = InsuranceClaim::query()->lockForUpdate()->findOrFail($claim->id);

            if (! $this->authorization->canReviewClaim($actor, $locked)) {
                abort(403);
            }

            $locked->update(['status' => InsuranceClaimStatus::UnderReview]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceClaimReviewStarted, null, $locked, [
                'reference' => $locked->reference,
            ]);

            return $locked;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function approve(InsuranceClaim $claim, array $data, User $actor): InsuranceClaim
    {
        return DB::transaction(function () use ($claim, $data, $actor): InsuranceClaim {
            $locked = InsuranceClaim::query()->lockForUpdate()->findOrFail($claim->id);
            $policy = FarmInsurance::query()->lockForUpdate()->findOrFail($locked->farm_insurance_id);

            if (! $this->authorization->canDecideClaim($actor, $locked)) {
                abort(403);
            }

            $approved = (float) $data['approved_amount'];

            if ($approved <= 0 || $approved > (float) $locked->claimed_amount) {
                throw ValidationException::withMessages([
                    'approved_amount' => 'The approved amount must be greater than zero and no more than the claimed amount.',
                ]);
            }

            if ($policy->amount !== null && $approved > (float) $policy->amount) {
                throw ValidationException::withMessages([
                    'approved_amount' => 'The approved amount cannot exceed the insured value.',
                ]);
            }

            $locked->update([
                'status' => InsuranceClaimStatus::Approved,
                'approved_amount' => $data['approved_amount'],
                'assessment' => $data['assessment'],
                'decided_by' => $actor->id,
                'decided_at' => now(),
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceClaimApproved, null, $locked, [
                'reference' => $locked->reference,
                'approved_amount' => (string) $data['approved_amount'],
            ]);

            return $locked;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function reject(InsuranceClaim $claim, array $data, User $actor): InsuranceClaim
    {
        return DB::transaction(function () use ($claim, $data, $actor): InsuranceClaim {
            $locked = InsuranceClaim::query()->lockForUpdate()->findOrFail($claim->id);

            if (! $this->authorization->canDecideClaim($actor, $locked)) {
                abort(403);
            }

            $locked->update([
                'status' => InsuranceClaimStatus::Rejected,
                'rejection_reason' => $data['reason'],
                'assessment' => $data['assessment'] ?? null,
                'decided_by' => $actor->id,
                'decided_at' => now(),
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceClaimRejected, null, $locked, [
                'reference' => $locked->reference,
                'reason' => (string) $data['reason'],
            ]);

            return $locked;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function settle(InsuranceClaim $claim, array $data, User $actor): InsuranceClaim
    {
        return DB::transaction(function () use ($claim, $data, $actor): InsuranceClaim {
            $locked = InsuranceClaim::query()->lockForUpdate()->findOrFail($claim->id);

            if (! $this->authorization->canSettle($actor, $locked)) {
                abort(403);
            }

            $amount = (float) $data['settlement_amount'];

            if ($locked->approved_amount === null || $amount <= 0 || $amount > (float) $locked->approved_amount) {
                throw ValidationException::withMessages([
                    'settlement_amount' => 'The settlement cannot exceed the approved amount.',
                ]);
            }

            $locked->update([
                'status' => InsuranceClaimStatus::Settled,
                'settlement_amount' => $data['settlement_amount'],
                'settlement_reference' => $data['settlement_reference'],
                'settled_at' => now(),
                'settled_by' => $actor->id,
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceClaimSettled, null, $locked, [
                'reference' => $locked->reference,
                'settlement_reference' => (string) $data['settlement_reference'],
                'settlement_amount' => (string) $data['settlement_amount'],
            ]);

            return $locked;
        });
    }

    public function close(InsuranceClaim $claim, User $actor): InsuranceClaim
    {
        return DB::transaction(function () use ($claim, $actor): InsuranceClaim {
            $locked = InsuranceClaim::query()->lockForUpdate()->findOrFail($claim->id);

            if (! $this->authorization->canClose($actor, $locked)) {
                abort(403);
            }

            $locked->update([
                'status' => InsuranceClaimStatus::Closed,
                'closed_at' => now(),
            ]);

            $this->accessEvents->handle($actor, AccessEventAction::InsuranceClaimClosed, null, $locked, [
                'reference' => $locked->reference,
            ]);

            return $locked;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertEligible(FarmInsurance $policy, array $data): void
    {
        if (! $policy->status->coversClaims()) {
            throw ValidationException::withMessages([
                'policy' => 'A claim can be submitted only on an active or expired policy.',
            ]);
        }

        if (! $policy->coversDate($data['incident_date'])) {
            throw ValidationException::withMessages([
                'incident_date' => 'The incident date is outside this policy’s coverage dates.',
            ]);
        }

        if ((float) $data['claimed_amount'] > (float) $policy->amount) {
            throw ValidationException::withMessages([
                'claimed_amount' => 'The claimed amount cannot exceed the insured value.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertSameClaim(InsuranceClaim $existing, FarmInsurance $policy, array $data): void
    {
        $same = (int) $existing->farm_insurance_id === (int) $policy->id
            && (string) $existing->claimed_amount === number_format((float) $data['claimed_amount'], 2, '.', '');

        if (! $same) {
            throw ValidationException::withMessages([
                'client_token' => 'This claim token was already used for a different claim.',
            ]);
        }
    }
}
