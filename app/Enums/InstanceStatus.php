<?php

declare(strict_types=1);

namespace App\Enums;

enum InstanceStatus: string
{
    case Online = 'online';
    case Degraded = 'degraded';
    case Offline = 'offline';
}
