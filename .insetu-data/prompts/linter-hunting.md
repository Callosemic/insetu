Review these linter and tests results to check all the violations picked up by our fitness functions and unit tests. For each one, determine:

1) what is the purpose of the linter rule or unit test, and is this an actual violation?

2)
- a) if this is NOT a real violation, because the linter/test logic is actually wrong or because it is running against the wrong file/function, determine whether you need to whitelist the function or file, rewrite the linter/test function, or report back to me to make a decision.
- b) if this IS a real violation, fix it in an architecturally pure way, that doesn’t introduce technical debt, logic problems, domain leaks, etc. If this requires deeper thinking and decision making, report back to me instead of patching.

3) if patching, let me know if the provided solution is enough or whether a deeper abstraction is necessary to truly resolve the issue

There may be too many violations to do in one go, so address no more than 25-50 violations, and batch them into similar fix sets. If more remain, I'll apply, rerun the linter, and pass the results to a clean session with the same instructions 
