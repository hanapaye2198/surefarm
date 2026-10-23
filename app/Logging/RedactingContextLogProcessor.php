<?php

namespace App\Logging;

use App\Support\LogRedactor;
use Illuminate\Contracts\Log\ContextLogProcessor as ContextLogProcessorContract;
use Illuminate\Log\Context\ContextLogProcessor;
use Monolog\LogRecord;

class RedactingContextLogProcessor implements ContextLogProcessorContract
{
    public function __construct(private LogRedactor $redactor) {}

    public function __invoke(LogRecord $record): LogRecord
    {
        $record = (new ContextLogProcessor)($record);

        return $record->with(
            context: $this->redactor->redact($record->context),
            extra: $this->redactor->redact($record->extra),
        );
    }
}
