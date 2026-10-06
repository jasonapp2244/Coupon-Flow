<?php

namespace App\Enums;

enum CouponType: string
{
    case Code = 'Coupon Code';
    case Deal = 'Deal';
    case NoCode = 'No Code Required';
}
