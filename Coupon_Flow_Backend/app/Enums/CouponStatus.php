<?php

namespace App\Enums;

enum CouponStatus: string
{
    case Active = 'Active';
    case Inactive = 'Inactive';
    case Expired = 'Expired';
    case Scheduled = 'Scheduled';
    case Draft = 'Draft';
}
