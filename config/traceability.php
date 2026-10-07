<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Stages that can start a traceability lot
    |--------------------------------------------------------------------------
    |
    | Coffee lots begin at green beans. Add another processing-stage code
    | here if traceability should start earlier. Names stay in the database.
    |
    */

    'eligible_stage_codes' => [
        'GREEN_BEANS',
    ],

];
