<?php

namespace Tests\Support;

use Stripe\HttpClient\ClientInterface;

/**
 * Replaces Stripe's cURL client in tests: the real SDK builds and parses every
 * request, but nothing leaves the machine. Responses are queued per path prefix.
 */
class FakeStripeHttpClient implements ClientInterface
{
    /** @var list<array{method: string, path: string, params: array<string, mixed>, headers: array<int, string>}> */
    public array $requests = [];

    /** @var array<string, list<array{0: int, 1: array<string, mixed>}>> */
    private array $responses = [];

    /** @param array<string, mixed> $body */
    public function respond(string $method, string $pathPrefix, array $body, int $status = 200): self
    {
        $this->responses[strtoupper($method).' '.$pathPrefix][] = [$status, $body];

        return $this;
    }

    public function request($method, $absUrl, $headers, $params, $hasFile, $apiMode = 'v1', $maxNetworkRetries = null)
    {
        $path = parse_url($absUrl, PHP_URL_PATH);
        $this->requests[] = ['method' => strtoupper($method), 'path' => $path, 'params' => $params, 'headers' => $headers];

        foreach ($this->responses as $key => &$queue) {
            [$m, $prefix] = explode(' ', $key, 2);
            if ($m === strtoupper($method) && str_starts_with($path, $prefix) && $queue) {
                [$status, $body] = count($queue) > 1 ? array_shift($queue) : $queue[0];

                return [json_encode($body), $status, ['request-id' => 'req_test']];
            }
        }

        throw new \LogicException("Unexpected Stripe request: {$method} {$path}");
    }
}
