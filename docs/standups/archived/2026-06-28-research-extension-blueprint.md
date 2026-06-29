
## 🏗️ inSetu Research Extension: Architectural Blueprint
### Phase 1: The Persistent State Layer (research.db)
To support pausing, resuming, and fault-tolerance, the extension will rely on a dedicated SQLite database located in the workspace's local configuration directory (.insetu/data/research.db).
 * **Table: research_jobs**
   * Tracks the overarching search queries and their execution state.
   * **Columns:** id (UUID), query (text), provider (text), status (running, paused, completed, cancelled, failed), total_links (int), processed_links (int), created_at (timestamp).
 * **Table: research_inbox**
   * Tracks the individual URLs and their parsed Markdown payloads.
   * **Columns:** id (UUID), job_id (FK), url (text), title (text), raw_markdown (text), status (pending, accepted, rejected), scraped_at (timestamp).
### Phase 2: The Search Strategy Pattern
The backend will use a Factory and Strategy pattern to isolate *how* links are acquired from *how* they are processed.
 * **The Interface (SearchProvider):** * Defines a standard execute_search(query, max_results, date_range) method that always returns a uniform array of dictionaries: [{"url": "...", "title": "..."}].
 * **Concrete Implementations:**
    * DuckDuckGoHTMLProvider: Uses native `urllib.request` and BeautifulSoup. Translates UI date inputs into DDG's required &df=YYYY-MM-DD..YYYY-MM-DD URL parameter.
    * GooglePlaywrightProvider: (Future Stub) Ready for headless browser implementation.
 * **The Ingestion Pipeline:** Once the provider returns the URLs, they are passed to the exact Jina Reader/BeautifulSoup extraction logic you just built, cleanly separating link discovery from DOM extraction.

 ### Phase 2.5: Technical Debt & Decoupling (Pre-Requisite)
 * **URL Extraction Decoupling:** The Jina/BS4 parsing logic is currently hardcoded inside `app.py` (`/api/fs/import-url`). Before building the ingestion pipeline, this logic MUST be decoupled into a centralized `utils_scraping.py` so both the core OS and the Research extension can share the exact same extraction engine.
 * **UDF Compliance:** Ensure the new `ext_research.js` strictly follows the Unidirectional Data Flow standard (Rule 4). It must dispatch state changes to a centralized store rather than reading active jobs directly from DOM element values.

 ### Phase 3: The Asynchronous Event Loop (Pacing & Interruption)
Heavy scraping must never block the Flask/Uvicorn HTTP thread. This phase handles the "low and slow" pacing and the lifecycle controls (Cancel/Pause/Resume).
 * **The Global Event Map:** The Python backend will maintain a lightweight dictionary mapping job IDs to standard threading events: ACTIVE_JOBS = {"job_uuid": threading.Event()}.
 * **The Paced Worker Thread:** * Instead of a blocking time.sleep(30), the background thread will use ACTIVE_JOBS[job_id].wait(timeout=30).
   * If the 30 seconds expire normally, the thread scrapes the next URL and loops.
   * If the event is externally triggered by the UI, the thread wakes up instantly, checks the SQLite jobs status (Paused or Cancelled), commits any pending DB transactions, and gracefully exits the thread to free up RAM.
 * **Resume Logic:** Hitting "Resume" simply creates a new thread, queries the inbox for URLs where job_id = ? AND scraped_at IS NULL, and begins a fresh paced loop over the remainder.
### Phase 4: The Triage Interface
Instead of dumping unvetted data into the workspace, the UI will mount a dedicated inbox triage screen via the Extension Architecture.
 * **The Sub-Tab (ext_research.js):** Mounts a new "Research" sub-tab alongside "Files" and "Yomama" using ExtensionRegistry.
 * **The Three-Pane Layout:**
   * **Pane 1 (Control & Status):** Search inputs (Query, Provider, Start/End Dates, Jina vs BS4 toggle). Below it, a live-updating list of current/past jobs with Pause/Resume/Cancel buttons.
   * **Pane 2 (The Inbox):** A list of URLs that have successfully finished parsing, pulled from the research_inbox table where status = pending.
   * **Pane 3 (The Preview):** A read-only Markdown viewer to inspect the scraped content of the selected link.
 * **Disposition Routing:**
   * **Reject:** Updates the inbox status to rejected, dropping it from the UI.
   * **Accept:** Converts the pending item into a permanent research artifact. Updates the SQLite status to accepted and physically saves the parsed Markdown note into a dedicated research/ directory (or user-defined target) within the active workspace, keeping the Kanban board strictly for actionable engineering tasks.
### Phase 5: Extension Compliance
 * **Zero-Overhead Booting:** The engine_research.py blueprint will only mount if "research" is explicitly listed in the workspace's config.json extensions array.
 * **Centralized Utilities:** All workspace pathing and SQLite initialization will route through insetu.utils_core.py to ensure spatial physics remain perfectly anchored to the active profile.