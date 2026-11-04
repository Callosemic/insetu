---
title: "Tracker: End-of-Session Changelog & Ticket Alignment"
description: "Protocol for closing completed tracker tickets in sys.tracker_dir and generating retrospective changelog epics at session closeout."
---

### Tracker: End-of-Session Ticket & Changelog Protocol (`{{ sys.tracker_dir }}`)

1. **Closing Existing Tickets:**
   * If an existing ticket under `{{ sys.tracker_dir }}` matches work completed in the diffs, update its `status` to `closed` (the background sweeper will relocate the file into the `closed/` directory and stamp `closed_at` automatically).
   * Refine the ticket's `title` and expand `## Description` and `## Notes / Execution Log` with a thorough technical summary of the resolution. Always preserve or add detail rather than summarizing it away.

2. **Drafting New Changelog Epics (Strict Genesis Block Rules):**
   * If no existing ticket covers the completed changes, create a new closed changelog ticket using a genesis patch (`<<<<<<< SEARCH\n=======`):
     * **Target Path:** `<<<<<<< FILE: {{ sys.tracker_closed_dir }}/changelog_<YYYYMMDD_HHMM>.md`
     * **YAML Frontmatter:**
       * `id`: `"{REPO}-CHG-<YYYYMMDD_HHMM>"` (e.g., `"INSETU-CHG-20261103_0520"`)
       * `title`: Concise summary string wrapped in double quotes.
       * `repo`: `{{ sys.repo_name }}`
       * `type`: `epic`
       * `status`: `closed`
       * `sub_bucket`: `None`
       * `tier`: `2`
       * **Timestamps:** Do **not** fabricate `created_at` or `closed_at` timestamps on a brand-new genesis ticket (the tracker sweeper stamps them automatically). When editing an existing ticket, faithfully preserve its existing timestamps.
     * **Markdown Body:** Provide a comprehensive, bulleted breakdown of all architectural and code changes under `## Description`, followed by test/linter verification notes under `## Notes / Execution Log`.
