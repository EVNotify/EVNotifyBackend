#!/usr/bin/env bash
set -euo pipefail

node --version
npm install --unsafe-perm --no-audit --package-lock=false

node <<'NODE'
const fs = require('fs');
const config = require('./srv_config.template.json');
config.DB_HOST = '127.0.0.1';
config.DB_PW = 'ci-password';
fs.writeFileSync('srv_config.json', JSON.stringify(config));
NODE

node index.js > backend.log 2>&1 &
backend_pid=$!
cleanup() {
    result=$?
    if [ "$result" -ne 0 ]; then cat backend.log; fi
    kill "$backend_pid" 2>/dev/null || true
    exit "$result"
}
trap cleanup EXIT

node <<'NODE'
const http = require('http');
const deadline = Date.now() + 60000;
const check = () => {
    const request = http.get('http://127.0.0.1:8000/settings', response => {
        response.resume();
        if (response.statusCode === 400) process.exit(0);
        retry();
    });
    request.setTimeout(1000, () => request.destroy(new Error('Readiness request timed out')));
    request.on('error', retry);
};
const retry = () => {
    if (Date.now() >= deadline) {
        console.error('Backend did not become ready within 60 seconds');
        process.exit(1);
    }
    setTimeout(check, 500);
};
check();
NODE

# The MySQL service was initialized before this container started.
node node_modules/mocha/bin/_mocha tests/*
