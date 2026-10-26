<?php

namespace App\Actions;

use App\Models\FarmFinancing;
use App\Models\FinancingDocument;
use App\Models\User;
use App\Services\FinancingAuthorization;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StoreFinancingDocument
{
    public function __construct(private FinancingAuthorization $authorization) {}

    public function handle(FarmFinancing $financing, UploadedFile $file, User $actor): FinancingDocument
    {
        if (! $this->authorization->canUpload($actor, $financing)) {
            abort(403);
        }

        $name = Str::of($file->getClientOriginalName())->basename()->limit(180, '')->toString();
        $name = $name !== '' ? $name : 'document';
        $path = $file->storeAs(
            'financing/'.$financing->id,
            Str::uuid()->toString().'.'.$file->extension(),
            'local',
        );

        if ($path === false) {
            abort(500, 'The document could not be stored.');
        }

        return DB::transaction(function () use ($financing, $actor, $name, $path): FinancingDocument {
            return $financing->documents()->create([
                'path' => $path,
                'original_name' => $name,
                'uploaded_by' => $actor->id,
            ]);
        });
    }
}
