<?php

namespace App\Enums;

enum BlogStatus: string
{
    case Published = 'Published';
    case Draft = 'Draft';
    case Archived = 'Archived';
}
