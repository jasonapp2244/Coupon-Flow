<?php

namespace App\Mail;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OrderPaidMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public readonly Order $order)
    {
        $this->afterCommit();
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Your coupon codes — order #{$this->order->id}");
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.orders.paid',
            with: [
                'items' => $this->order->items,
                'total' => number_format($this->order->total_cents / 100, 2).' '.strtoupper($this->order->currency),
                'ordersUrl' => config('services.frontend.public_url').'/account/orders/'.$this->order->id,
            ],
        );
    }
}
