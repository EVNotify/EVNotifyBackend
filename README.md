# EVNotifyBackend

[![Greenkeeper badge](https://badges.greenkeeper.io/EVNotify/EVNotifyBackend.svg)](https://greenkeeper.io/)
[![CI](https://github.com/EVNotify/EVNotifyBackend/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/EVNotify/EVNotifyBackend/actions/workflows/ci.yml)

Backend for [EVNotify](https://github.com/EVNotify/EVNotify).

## Features

- Account registration and authentication
- Vehicle sync endpoints for SOC, location, and extended telemetry
- Notifications via mail, push, and Telegram
- Optional outbound webhooks for sync and notification events
- Error tracking through Rollbar

## Extended vehicle telemetry

`POST /extended` accepts optional measurements for any vehicle whose client can supply them. The backend does not decode vehicle data or restrict these fields to the Ioniq. Use JSON numbers, with voltages in **volts**, odometer in **whole kilometers**, and fan speed as a **raw numeric level** (not RPM or percent; levels may differ between vehicles).

| POST field | GET `/extended` and history field | Storage and accepted range |
| --- | --- | --- |
| `batteryCellVoltageMin` | `battery_cell_voltage_min` | `DECIMAL(12,6)`, 0–999999.999999 V |
| `batteryCellVoltageMax` | `battery_cell_voltage_max` | `DECIMAL(12,6)`, 0–999999.999999 V |
| `batteryCellVoltageDelta` | `battery_cell_voltage_delta` | `DECIMAL(12,6)`, 0–999999.999999 V |
| `batteryFanSpeed` | `battery_fan_speed` | `FLOAT`, nonnegative and finite when represented as a 32-bit float |
| `odo` | `odo` | Existing signed `INT`, integer 0–2147483647 km |

All five fields also accept `null`. An omitted field retains its current value; an explicit `null` clears it. Partial updates preserve omitted values across **all** extended telemetry fields. Zero is a measurement and is stored unchanged. New installations and migrated schemas default unknown odometer and new battery measurements to `NULL`; existing stored odometer zeros are retained.

Voltages are rounded to six decimal places before storage; fan levels are normalized to 32-bit float precision. Delta is supplied by the client and remains in volts; the backend does not calculate it from retained minimum/maximum values. Fractional odometers, negative values, strings, booleans, other nonnumeric types, and out-of-range numbers in these five fields reject the entire telemetry submission with HTTP 400 and `INVALID_PARAMETERS`. Existing authentication and database-error responses are retained.

```json
{
  "akey": "ABC123",
  "token": "your-api-token",
  "batteryCellVoltageMin": 3.78,
  "batteryCellVoltageMax": 3.8,
  "batteryCellVoltageDelta": 0.02,
  "batteryFanSpeed": 0,
  "odo": 123456
}
```

`GET /extended?akey=ABC123&token=your-api-token` returns these fields as JSON numbers or `null`, using the snake_case names above. A later POST with only `batteryCellVoltageDelta: 0.01` updates that measurement and retains the other current values. Sending `batteryFanSpeed: null` clears only the fan measurement.

History remains sparse: statistics record only measurements supplied in that submission, subject to the existing five-second history throttle. Retained current values are not copied into history. `/logdetail` exposes the new columns in live and archived statistics. Both XLSX report paths include an extended telemetry sheet with numeric measurements, voltage headers in V, odometer in km, a raw fan-level header, and blank unknown cells. English and German labels are available.

### Database migration

Fresh installations use `modules/db/db_template.sql`. Existing installations must run the manual, rerunnable [migration](modules/db/migrations/extended_vehicle_telemetry.sql) **before deploying the updated backend**:

1. Back up the selected database, including archive tables. Pause both `archiveLogs` and `archiveStandaloneLogs` jobs and wait for active runs to finish. Schedule a maintenance window for ALTER TABLE locks; MySQL DDL commits implicitly.
2. Use an account with `SELECT` and `ALTER` on the target tables and `CREATE ROUTINE`, `ALTER ROUTINE`, and `EXECUTE` privileges on the database. Run the following with the MySQL CLI, selecting the actual database:

   ```bash
   mysql -h DB_HOST -u DB_USER -p DB_NAME < modules/db/migrations/extended_vehicle_telemetry.sql
   ```

3. Verify that `sync`, `statistics`, existing `statistics_MONTH_YEAR` archives, and `statistics_log_ID` archives each contain the four nullable battery columns with the types listed above, and that `sync.odo` defaults to `NULL`. Check that existing row counts and odometer values are unchanged. The migration adds only missing columns; it does not repair conflicting preexisting definitions. If interrupted, rerun it after resolving the error.
4. Deploy the backend, check a POST/GET round trip, and resume archive jobs. Future archives inherit the updated statistics schema. Monitor API database errors and archive-job failures.

The migration supports MySQL 5.7 and 8.0. It leaves historical unknowns `NULL`, preserves the existing odometer type and values, and does not backfill measurements. To roll back application code, retain the additive columns and restored defaults rather than dropping recorded telemetry.

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

Delivery happens in the background with a 10-second request timeout and no retries. Transport errors and non-2xx HTTP responses (including redirects) are logged. HTTP failure logs include the status code without URLs, credentials, payloads, or response bodies. A successful API response does not confirm webhook delivery. Rejected API requests and rate-limited notifications do not emit events.

## Development

Install dependencies with `npm install`. GitHub Actions runs the full test suite in Docker using Node 8.17.0 and MySQL 5.7.34, with a disposable test database.

Hound's older JavaScript parser is disabled. The three existing report/export TODOs have individual ESLint suppressions; other CodeFactor checks remain enabled.

Run the isolated settings, webhook, sync, notification, and XLSX tests without a backend or database:

```bash
./node_modules/.bin/mocha tests/settings tests/webhook tests/sync tests/notification tests/report
```

The full suite also includes account integration tests, which require a running backend at `TEST_URL` (or the configured local port) and a local test database configured in `srv_config.json`. Its setup creates the database and imports the schema. Telemetry integration tests additionally create and remove uniquely named disposable databases using the same connection credentials; the test user needs database creation/deletion and routine privileges. They test migration reruns, both archive formats, HTTP round trips, and account isolation:

```bash
npm test
```

## Contributing

Feel free to contribute and report issues or suggestions. If you are a developer and want to contribute, have a look at [CONTRIBUTING.md](CONTRIBUTING.md).

The app and backend use Rollbar to track uncaught errors and speed up debugging.

<a href="https://rollbar.com"><img src="https://rollbar.com/assets/badges/rollbar-partner-badge-light.png" alt="Rollbar Error Tracking" /></a>
