<?php

namespace App\Enums;

enum StoreStatus: string
{
    case Active = 'Active';
    case Inactive = 'Inactive';
    case Draft = 'Draft';
}
