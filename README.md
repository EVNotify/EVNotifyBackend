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

If a user has a `webhook` URL stored in `settings`, the backend sends a `POST` request to that URL for these event types:

- `soc`
- `location`
- `extended`
- `notification`

The JSON payload contains:

```json
{
  "akey": "ABC123",
  "token": "user-token",
  "type": "soc",
  "response": {}
}
```

## Development

Install dependencies with `npm install`.

Run the test suite with:

```bash
npm test
```

## Contributing

Feel free to contribute and report issues or suggestions. If you are a developer and want to contribute, have a look at [CONTRIBUTING.md](CONTRIBUTING.md).

The app and backend use Rollbar to track uncaught errors and speed up debugging.

<a href="https://rollbar.com"><img src="https://rollbar.com/assets/badges/rollbar-partner-badge-light.png" alt="Rollbar Error Tracking" /></a>
