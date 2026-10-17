# EVNotifyBackend

[![Greenkeeper badge](https://badges.greenkeeper.io/EVNotify/EVNotifyBackend.svg)](https://greenkeeper.io/)
[![Build Status](https://travis-ci.org/EVNotify/EVNotifyBackend.svg?branch=greenkeeper%2Finitial)](https://travis-ci.org/EVNotify/EVNotifyBackend)

Backend for [EVNotify](https://github.com/EVNotify/EVNotify).

## Features

- Account registration and authentication
- Vehicle sync endpoints for SOC, location, and extended telemetry
- Notifications via mail, push, and Telegram
- Optional outbound webhooks for sync and notification events
- Error tracking through Rollbar

## Webhooks

Webhooks are configured by an administrator on request, directly in the user's `settings.webhook` database column. `GET /settings` returns the configured URL. `PUT /settings` ignores any submitted `webhook` value and omits it from its response; users cannot change or disable delivery through the API. To disable delivery, an administrator sets the database value to `NULL` or an empty string.

Stored webhook URLs must be absolute HTTPS URLs with a hostname and a valid port. HTTP and invalid URLs are logged and skipped before DNS lookup or delivery, without interrupting API requests. Administrators must replace existing HTTP URLs with HTTPS endpoints; stored values are not automatically changed.

Destinations must resolve exclusively to public IPv4 or IPv6 addresses. Loopback, private, link-local (including cloud metadata), reserved, and other non-public addresses are blocked, including alternate IP spellings and IPv4-mapped IPv6 addresses containing blocked IPv4 addresses. DNS lookup failures or a lookup taking longer than 10 seconds skip delivery. Connections use a checked address without resolving again; proxies and redirects are disabled for all webhook requests. Blocked destinations are logged without changing the stored URL or interrupting API requests.

The backend sends a JSON `POST` directly to the configured URL, including its path, after successful sync or notification requests:

- `soc`
- `location`
- `extended`
- `notification`

The JSON payload contains:

```json
{
  "akey": "ABC123",
  "type": "soc",
  "response": {}
}
```

| Event type | `response` contents |
| --- | --- |
| `soc` | Submitted `display` and `bms` readings |
| `location` | Submitted `location` object |
| `extended` | Submitted telemetry body, with `token` removed |
| `notification` | `soc_display`, `soc_bms`, and the submitted `abort` flag |

The account's API `token` is included only as an outer payload field when the URL uses HTTPS and its hostname is exactly `evnotify.de`, `evnotify.com`, or a subdomain of either. Matching is case insensitive and requires a dot boundary: `api.evnotify.de` qualifies, but `fakeevnotify.de` and `evnotify.de.attacker.com` do not. Other destinations receive events without a token. Requests carrying tokens never follow redirects.

Delivery happens in the background with a 10-second request timeout and no retries. Transport errors are logged; HTTP failure status codes are not checked. A successful API response does not confirm webhook delivery. Rejected API requests and rate-limited notifications do not emit events.

## Development

Install dependencies with `npm install`.

Run the isolated settings, webhook, sync, and notification tests without a backend or database:

```bash
./node_modules/.bin/mocha tests/settings/index.js tests/webhook/index.js tests/sync/index.js tests/notification/index.js
```

The full suite also includes account integration tests, which require a running backend at `TEST_URL` (or the configured local port) and a local test database configured in `srv_config.json`. Its setup creates the database and imports the schema:

```bash
npm test
```

## Contributing

Feel free to contribute and report issues or suggestions. If you are a developer and want to contribute, have a look at [CONTRIBUTING.md](CONTRIBUTING.md).

The app and backend use Rollbar to track uncaught errors and speed up debugging.

<a href="https://rollbar.com"><img src="https://rollbar.com/assets/badges/rollbar-partner-badge-light.png" alt="Rollbar Error Tracking" /></a>
