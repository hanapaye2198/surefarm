<?php

namespace App\Actions;

use App\Models\FarmInsurance;
use App\Models\InsuranceClaim;
use App\Models\InsuranceDocument;
use App\Models\User;
use App\Services\InsuranceAuthorization;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StoreInsuranceDocument
{
    public function __construct(private InsuranceAuthorization $authorization) {}

    public function forPolicy(FarmInsurance $policy, UploadedFile $file, User $actor): InsuranceDocument
    {
        if (! $this->authorization->canUpload($actor, $policy)) {
            abort(403);
        }

        return $this->store($file, $actor, $policy->id, null);
    }

    public function forClaim(InsuranceClaim $claim, UploadedFile $file, User $actor): InsuranceDocument
    {
        $policy = $claim->policy;

        if (! $policy instanceof FarmInsurance || ! $this->authorization->manage($actor)) {
            abort(403);
        }

        return $this->store($file, $actor, $policy->id, $claim->id);
    }

    private function store(UploadedFile $file, User $actor, int $policyId, ?int $claimId): InsuranceDocument
    {
        $name = Str::of($file->getClientOriginalName())->basename()->limit(180, '')->toString();
        $name = $name !== '' ? $name : 'document';
        $folder = $claimId === null ? 'insurance/'.$policyId : 'insurance/'.$policyId.'/claims/'.$claimId;
        $path = $file->storeAs($folder, Str::uuid()->toString().'.'.$file->extension(), 'local');

        if ($path === false) {
            abort(500, 'The document could not be stored.');
        }

        return DB::transaction(function () use ($policyId, $claimId, $name, $path, $actor): InsuranceDocument {
            return InsuranceDocument::query()->create([
                'farm_insurance_id' => $policyId,
                'insurance_claim_id' => $claimId,
                'path' => $path,
                'original_name' => $name,
                'uploaded_by' => $actor->id,
            ]);
        });
    }
}
