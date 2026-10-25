// Standalone tooling tests run on the lint job's Node version, without backend dependencies.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const script = path.join(__dirname, 'lint-changes.js');
const jshint = path.resolve(process.argv[2]);
let failed = 0;

const checkCase = (name, run) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'evnotify-lint-'));
    const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
    const write = (file, contents) => fs.writeFileSync(path.join(directory, file), contents);
    const commit = () => {
        git(['add', '.']);
        git(['-c', 'user.name=Lint Test', '-c', 'user.email=lint@example.com', 'commit', '-qm', 'fixture']);
        return git(['rev-parse', 'HEAD']);
    };
    const lint = (base, head) => {
        const result = spawnSync(process.execPath, [script, jshint, base, head], { cwd: directory, encoding: 'utf8' });
        if (result.error) throw result.error;
        return { status: result.status, output: result.stdout + result.stderr };
    };
    try {
        git(['init', '-q']);
        write('.jshintrc', JSON.stringify({ esversion: 8, undef: true, unused: true, node: true }));
        write('legacy.js', 'var unused = 1;\nprocess.stdout.write("ok");\n');
        const base = commit();
        run({ directory, git, write, commit, lint, base });
        console.log('PASS ' + name);
    } catch (error) {
        failed++;
        console.error('FAIL ' + name + ': ' + error.message);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
};

checkCase('ignores an existing warning on unchanged lines of a modified file', fixture => {
    fixture.write('legacy.js', 'var unused = 1;\nprocess.stdout.write("ok");\nprocess.stdout.write("changed");\n');
    const result = fixture.lint(fixture.base, fixture.commit());
    assert.strictEqual(result.status, 0, result.output);
    assert.ok(result.output.includes('1 warnings outside changed lines ignored'));
});

checkCase('rejects a new warning on an added line', fixture => {
    fixture.write('legacy.js', 'var unused = 1;\nprocess.stdout.write("ok");\nmissingValue();\n');
    const result = fixture.lint(fixture.base, fixture.commit());
    assert.strictEqual(result.status, 1, result.output);
    assert.ok(result.output.includes('legacy.js:3:'));
    assert.ok(result.output.includes('W117'));
});

checkCase('rejects a new warning on a modified line', fixture => {
    fixture.write('legacy.js', 'var unused = 1;\nprocess.stdout.write(missingValue);\n');
    const result = fixture.lint(fixture.base, fixture.commit());
    assert.strictEqual(result.status, 1, result.output);
    assert.ok(result.output.includes('legacy.js:2:'));
});

checkCase('does not treat the preceding line as changed for a deletion-only hunk', fixture => {
    fixture.write('legacy.js', 'var unused = 1;\n');
    const result = fixture.lint(fixture.base, fixture.commit());
    assert.strictEqual(result.status, 0, result.output);
    assert.ok(result.output.includes('1 warnings outside changed lines ignored'));
});

checkCase('checks new JavaScript files completely, including paths with spaces', fixture => {
    fixture.write('new file.js', 'missingValue();\n');
    const result = fixture.lint(fixture.base, fixture.commit());
    assert.strictEqual(result.status, 1, result.output);
    assert.ok(result.output.includes('new file.js:1:'));
});

checkCase('fails syntax errors even when the parser reports beyond changed lines', fixture => {
    fixture.write('legacy.js', 'function broken() {\nprocess.stdout.write("ok");\n');
    const result = fixture.lint(fixture.base, fixture.commit());
    assert.strictEqual(result.status, 1, result.output);
    assert.ok(result.output.includes('(E'));
});

checkCase('ignores deleted JavaScript files', fixture => {
    fixture.git(['rm', 'legacy.js']);
    const result = fixture.lint(fixture.base, fixture.commit());
    assert.strictEqual(result.status, 0, result.output);
    assert.ok(result.output.includes('0 JavaScript files checked'));
});

checkCase('succeeds when only non-JavaScript files change', fixture => {
    fixture.write('README.md', 'Documentation only.\n');
    const result = fixture.lint(fixture.base, fixture.commit());
    assert.strictEqual(result.status, 0, result.output);
    assert.ok(result.output.includes('0 JavaScript files checked'));
});

checkCase('checks all JavaScript on a first push without a base commit', fixture => {
    const result = fixture.lint('0000000000000000000000000000000000000000', fixture.base);
    assert.strictEqual(result.status, 1, result.output);
    assert.ok(result.output.includes('legacy.js:1:'));
});

checkCase('fails when Git cannot resolve a comparison commit', fixture => {
    const result = fixture.lint('not-a-commit', fixture.base);
    assert.strictEqual(result.status, 1, result.output);
});

process.exitCode = failed ? 1 : 0;
