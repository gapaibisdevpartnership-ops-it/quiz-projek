# State and Data Flow

## General Rule

Server/database is authoritative for domain state.

Client state optimizes interaction only.

## Quiz Start

```text
Sales clicks Start
  ↓
server validates quiz + assignment + limits
  ↓
attempt created
  ↓
questions/options snapshotted
  ↓
safe attempt payload returned
```

## Quiz Resume

```text
Sales opens active attempt
  ↓
server loads attempt
  ↓
server returns safe questions/options + saved answers
  ↓
client hydrates player
```

## Objective Autosave

```text
select option
  ↓
optimistic UI optional
  ↓
save answer
  ↓
server validates ownership and active status
  ↓
persist
```

UI should show save failure and allow retry.

## Essay Autosave

```text
user types
  ↓
local draft
  ↓
debounce
  ↓
save essay
  ↓
server acknowledgement
```

## Timer

Client display may tick locally.

Authoritative remaining time derives from:

- `started_at`;
- quiz duration;
- server clock/rules.

Refresh must reconstruct timer from server data.

## Submission

```text
submit
  ↓
server lock / idempotency
  ↓
objective scoring
  ↓
essay detection
  ↓
pending_review OR submitted
  ↓
result response
```

## Manual Grading

```text
trainer opens queue
  ↓
loads pending essay
  ↓
submits grade
  ↓
server validates
  ↓
save score + feedback
  ↓
if all essays graded:
    recalc final score
    finalize pass/fail
```

## Question Editing

Question Bank edits affect future snapshots only.

Existing attempt snapshots remain unchanged.
