# Architecture Decisions

## ADR-001 — Supabase RLS Is Authoritative

Status: Accepted

Reason:

The application contains role-based data, answer keys, user attempts, and grading data. Client-side authorization is insufficient.

Decision:

Use Supabase RLS and server-side checks as the security boundary.

## ADR-002 — Attempt Snapshots

Status: Accepted

Reason:

Questions and options can be edited after publishing. Historical attempts must remain consistent.

Decision:

Snapshot question and option data when an attempt starts.

## ADR-003 — Server-Side Scoring

Status: Accepted

Reason:

Client scoring can be manipulated and would require exposing answer-key logic.

Decision:

Score objective questions in trusted server/database logic.

## ADR-004 — Essay Manual Grading

Status: Accepted

Reason:

AI grading is outside V1 and manual assessment is required for open-ended sales responses.

Decision:

Essay answers enter a grading queue and contribute to final score after review.

## ADR-005 — Dynamic Answer Options

Status: Accepted

Reason:

Training questions may require varying numbers of options and media-based answers.

Decision:

Model answer options relationally. Do not hardcode A–D.

## ADR-006 — Supabase Storage for Quiz Media

Status: Accepted

Reason:

Questions and answer choices require image support.

Decision:

Use Supabase Storage with controlled upload rules and generated asset paths.
