<?php

namespace App;

enum CropType: string
{
    case Coffee = 'coffee';
    case Cacao = 'cacao';
    case Corn = 'corn';
    case Coconut = 'coconut';
    case Banana = 'banana';
    case Other = 'other';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
