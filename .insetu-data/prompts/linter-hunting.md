Review these linter and tests results to check all the violations picked up by our fitness functions and unit tests. For each one, determine:

1) what is the purpose of the linter rule or unit test, and is this an actual violation?

2)
- a) if this is NOT a real violation, because the linter/test logic is actually wrong or because it is running against the wrong file/function, determine whether you need to whitelist the function or file or rewrite the linter/test function. Report back to me what you do.
- b) if this IS a real violation, fix it in an architecturally pure way, that doesn’t introduce technical debt, logic problems, domain leaks, etc. If this requires deeper thinking and decision making on my part, let me know. That includes cases where a deeper abstraction might be necessary to truly resolve the issue
- c) distinguish between a violation of the test and the violation of engineering standards. there may be situations in which test violation represent out-of-date tests, due to new architecture. if you think that's the case, say so instead of issuing patches.

There may be too many violations to do in one go, so batch them into similar fix sets and only address what will comfortably fit in one output turn (explanations + patches).