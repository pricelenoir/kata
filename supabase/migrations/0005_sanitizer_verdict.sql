-- kata: "sanitizer" verdict.
--
-- Exercises can run a second, instrumented build of a solution
-- (ThreadSanitizer, AddressSanitizer + UBSan) after the regular tests pass;
-- a report from it is its own verdict. Keep in sync with VERDICTS in
-- types/submission.ts.

alter table public.submissions drop constraint if exists submissions_verdict_check;
alter table public.submissions add constraint submissions_verdict_check check (verdict in (
  'accepted', 'wrong_answer', 'time_limit', 'memory_limit',
  'runtime_error', 'compile_error', 'output_limit', 'sanitizer', 'internal_error'
));
