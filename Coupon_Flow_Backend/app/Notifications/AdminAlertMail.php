<?php

namespace App\Notifications;

use App\Services\SiteSettings;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email copy of an important admin alert (brand feed problems, coupons running out of uses).
 * Queued so a slow mail server never delays the request that raised it.
 */
class AdminAlertMail extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $text)
    {
        $this->afterCommit();
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $site = app(SiteSettings::class)->get('general', 'site_name');

        return (new MailMessage)
            ->subject("{$site}: {$this->text}")
            ->line($this->text)
            ->action('Open the admin dashboard', config('services.frontend.admin_url').'/#/');
    }
}
