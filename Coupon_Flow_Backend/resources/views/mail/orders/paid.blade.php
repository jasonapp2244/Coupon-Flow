<x-mail::message>
# Thanks for your purchase!

Your payment for order **#{{ $order->id }}** was successful. Here are your coupon codes:

<x-mail::table>
| Coupon | Code |
|:-------|:-----|
@foreach ($items as $item)
| {{ $item->title_snapshot }} | **{{ $item->code_snapshot ?? 'On its way: we will email it to you shortly' }}** |
@endforeach
</x-mail::table>

**Total paid:** {{ $total }}

<x-mail::button :url="$ordersUrl">
View your order
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
