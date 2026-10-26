<?php

namespace App\Notifications;

use App\Enums\Role;
use App\Models\User;
use App\Services\SiteSettings;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Notification as NotificationFacade;

/**
 * One-line activity entry shown in the admin dashboard's notification bell.
 */
class AdminActivity extends Notification
{
    public function __construct(public readonly string $text) {}

    /**
     * Always adds a bell entry. When $emailSwitch names a notification setting ("sync_alerts" for
     * brand feeds, "redemption_alerts" for usage limits) and both it and the master "email" switch
     * are on, admins and editors also get an email.
     */
    public static function broadcast(string $text, ?string $emailSwitch = null): void
    {
        // Admins and editors run the catalogue; viewers only read reports.
        $admins = User::whereIn('role', [Role::SuperAdmin, Role::Admin, Role::Editor])->whereNull('disabled_at')->get();
        NotificationFacade::send($admins, new self($text));

        $settings = app(SiteSettings::class);

        if ($emailSwitch && $settings->get('notifications', 'email') && $settings->get('notifications', $emailSwitch)) {
            NotificationFacade::send($admins, new AdminAlertMail($text));
        }
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, string> */
    public function toArray(object $notifiable): array
    {
        return ['text' => $this->text];
    }
}
