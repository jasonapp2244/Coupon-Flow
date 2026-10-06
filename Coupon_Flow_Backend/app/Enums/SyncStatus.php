<?php

namespace App\Enums;

enum SyncStatus: string
{
    case Completed = 'Completed';
    case Running = 'Running';
    case Partial = 'Partial';
    case Failed = 'Failed';
}
