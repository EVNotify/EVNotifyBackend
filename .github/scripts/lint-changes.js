const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

const changedLines = diff => {
    const ranges = [];
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
    let match;
    while ((match = hunk.exec(diff)) !== null) {
        ranges.push({ start: Number(match[1]), count: match[2] === undefined ? 1 : Number(match[2]) });
    }
    return line => ranges.some(range => line >= range.start && line < range.start + range.count);
};

const lintChanges = (jshint, base, head) => {
    const initialPush = !base || /^0+$/.test(base);
    let listing = ['ls-tree', '-r', '--name-only', '-z', head];
    if (!initialPush) listing = ['diff', '--name-only', '--no-renames', '--diff-filter=ACMR', '-z', base, head, '--', '*.js'];
    const files = git(listing).split('\0').filter(file => file.endsWith('.js'));
    const config = JSON.parse(fs.readFileSync('.jshintrc', 'utf8'));
    const issues = [];
    let ignored = 0;
    files.forEach(file => {
        const isChanged = initialPush ? () => true : changedLines(git([
            'diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--unified=0', base, head, '--', file
        ]));
        jshint(git(['show', head + ':' + file]), config);
        (jshint.errors || []).filter(Boolean).forEach(error => {
            // Syntax/configuration errors must fail even when parsing stops
            // outside the changed lines. Existing style warnings stay separate.
            if (error.code.charAt(0) === 'E' || isChanged(error.line)) issues.push({ file, error });
            else ignored++;
        });
    });
    issues.forEach(issue => console.error(issue.file + ':' + issue.error.line + ':' + issue.error.character +
        ': ' + issue.error.reason + ' (' + issue.error.code + ')'));
    console.log(files.length + ' JavaScript files checked; ' + ignored +
        ' warnings outside changed lines ignored; ' + issues.length + ' issues.');
    return issues.length ? 1 : 0;
};

if (require.main === module) {
    try {
        const args = process.argv.slice(2);
        if (args.length !== 3) throw new Error('Usage: node lint-changes.js <jshint-module-path> <base-sha> <head-sha>');
        process.exitCode = lintChanges(require(path.resolve(args[0])).JSHINT, args[1], args[2]);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}

module.exports = { changedLines, lintChanges };
