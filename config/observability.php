<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Error tracking
    |--------------------------------------------------------------------------
    |
    | "log" keeps exceptions in the application log. No external tracker is
    | connected. A different driver name is recorded once as not connected
    | and does not send the exception anywhere.
    |
    */

    'error_tracking' => [
        'driver' => env('ERROR_TRACKING_DRIVER', 'log'),
    ],

];
