<?php

namespace App\Http\Controllers;

use App\Models\User;

abstract class Controller
{
    protected function registryViewer(): ?User
    {
        $user = request()->user();

        return $user instanceof User ? $user : null;
    }
}
