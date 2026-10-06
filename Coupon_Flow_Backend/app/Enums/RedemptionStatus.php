<?php

namespace App\Enums;

enum RedemptionStatus: string
{
    case Clicked = 'Clicked';
    case Pending = 'Pending';
    case Used = 'Used';
    case Failed = 'Failed';
    case Expired = 'Expired';
}
