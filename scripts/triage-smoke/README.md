# Local Bug triage smoke fixture

A standalone pagination utility used to exercise Cobalt's issue-to-fix-PR workflow.
It is not imported by the Notes app and requires only Node.js.

Contract: count every page needed to contain all items, including a partially filled final page.
Empty lists need zero pages. Inputs must be integers; the item count must be nonnegative and page size positive.

Run checks: `node --test scripts/triage-smoke/pagination.checks.mjs`.
