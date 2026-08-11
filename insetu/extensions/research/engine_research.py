from pathlib import Path
import os
import uuid
from datetime import datetime
import urllib.request
import urllib.parse
import json
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from insetu.extensions.ingest.engine_ingest import extract_markdown_from_url
from insetu.kernel.workers import submit_job, register_callback
from insetu.kernel.hooks import hooks
RESEARCH_SCHEMA = {
    "research_jobs": {
        "id": "TEXT PRIMARY KEY",
        "query": "TEXT",
        "provider": "TEXT",
        "status": "TEXT",
        "total_links": "INTEGER DEFAULT 0",
        "processed_links": "INTEGER DEFAULT 0",
        "created_at": "TEXT",
        "meta_json": "TEXT DEFAULT '{}'"
    },
    "research_inbox": {
        "id": "TEXT PRIMARY KEY",
        "job_id": "TEXT",
        "url": "TEXT",
        "title": "TEXT",
        "raw_markdown": "TEXT",
        "status": "TEXT",
        "scraped_at": "TEXT"
    }
}
RESEARCH_SETTINGS_SCHEMA = [
    {
        "id": "serper_api_key",
        "label": "Serper.dev API Key",
        "type": "password",
        "secure": True,
        "scope": "workspace",
        "default": "",
        "description": "Required for Google Search provider. Obtain a free key at serper.dev."
    }
]
research_bp = InSetuExtension('research', __name__, title="Research Inbox", description="Web search, scraping, and AI triage inbox.", schema=RESEARCH_SCHEMA, settings_schema=RESEARCH_SETTINGS_SCHEMA)
__depends__ = ['ingest']

# --- SEARCH STRATEGY PATTERN ---
class SearchProvider:
    def execute_search(self, query, max_results=10, date_range=None, start_index=0):
        raise NotImplementedError

class DuckDuckGoHTMLProvider(SearchProvider):
    def execute_search(self, query, max_results=10, date_range=None, start_index=0):
        try:
            from bs4 import BeautifulSoup
        except ImportError:
            raise Exception("BeautifulSoup4 is required for DuckDuckGo local parsing.")
            
        safe_query = urllib.parse.quote(query)
        url = f"https://html.duckduckgo.com/html/?q={safe_query}"
        
        if date_range:
            url += f"&df={date_range}"
            
        # DDG requires a real-looking User-Agent
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        
        try:
            with urllib.request.urlopen(req) as response:
                html = response.read().decode('utf-8', errors='ignore')
        except Exception as e:
            raise Exception(f"Search request failed: {str(e)}")
            
        soup = BeautifulSoup(html, 'html.parser')
        results = []
        
        for a in soup.find_all('a', class_='result__url', limit=max_results):
            link = a.get('href')
            if link and not link.startswith('/'):
                title = a.parent.find_previous_sibling('h2', class_='result__title')
                title_text = title.text.strip() if title else "Untitled Link"
                
                # Unwrap DDG redirect links
                if '//duckduckgo.com/l/?' in link:
                    qs = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
                    if 'uddg' in qs:
                        link = qs['uddg'][0]
                        
                results.append({"url": link, "title": title_text})
                
        return results
class GooglePlaywrightProvider(SearchProvider):
    def execute_search(self, query, max_results=10, date_range=None, start_index=0):
        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
        except ImportError:
            raise Exception("Playwright is required for Google Search. Run: pip install playwright && playwright install chromium")
        import urllib.parse
        safe_query = urllib.parse.quote(query)
        # Drop the &num parameter. Requesting 150 results on a single page triggers bot defenses.
        # The Metronome naturally pages through 10 standard results at a time via &start=
        url = f"https://www.google.com/search?q={safe_query}&start={start_index}"

        # Handle Google's specific date range formatting
        if date_range:
            if date_range in ['d', 'w', 'm', 'y']:
                url += f"&tbs=qdr:{date_range}"
            elif ".." in date_range:
                try:
                    start, end = date_range.split("..")
                    s_parts, e_parts = start.split("-"), end.split("-")
                    if len(s_parts) == 3 and len(e_parts) == 3:
                        # Convert YYYY-MM-DD to Google's MM/DD/YYYY
                        url += f"&tbs=cdr:1,cd_min:{s_parts[1]}/{s_parts[2]}/{s_parts[0]},cd_max:{e_parts[1]}/{e_parts[2]}/{e_parts[0]}"
                except Exception:
                    pass

        results = []
        with sync_playwright() as p:
            # Stealth flags to bypass basic headless detection
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"]
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080}
            )
            page = context.new_page()
            try:
                start_index = 0
                while len(results) < max_results:
                    paged_url = url + f"&start={start_index}"
                    page.goto(paged_url, wait_until="domcontentloaded", timeout=15000)

                    # Auto-clear EU Cookie Consent if intercepted
                    if page.locator('form[action*="consent.google.com"]').count() > 0:
                        try:
                            page.locator('button:has-text("Reject all"), button:has-text("Accept all")').first.click(timeout=3000)
                        except PlaywrightTimeoutError:
                            pass

                    # Hard fail if we hit a CAPTCHA wall
                    if page.locator('div.g-recaptcha').count() > 0 or "sorry/index" in page.url:
                        raise Exception("Google blocked the search with a CAPTCHA. Please try again later or switch to DuckDuckGo.")
                    try:
                        # 2026 Update: Broaden selector to capture modern SERP links and avoid strict div.g dependence
                        page.wait_for_selector("div.g, a:has(h3), h3 a", timeout=8000)
                    except PlaywrightTimeoutError:
                        if page.locator('text="did not match any documents"').count() > 0:
                          break # Cleanly exit if no more documents
                        if results:
                          break # Safely return existing results rather than crashing
                        raise Exception("Search results failed to load. Google may have changed their layout or blocked the request.")

                    # Target any anchor tag wrapping or containing an h3, or within a standard result div
                    search_links = page.locator("a:has(h3), h3 a, div.g a:has(h3)")
                    count = search_links.count()
                    initial_count = len(results)

                    for i in range(count):
                        a_tag = search_links.nth(i)
                        link = a_tag.get_attribute("href")
                        title = a_tag.inner_text().strip()

                        # Some links might just be wrappers; try to extract the specific h3 text
                        h3_tag = a_tag.locator("h3").first
                        if h3_tag.count() > 0:
                          title = h3_tag.inner_text().strip()

                        if title and link and link.startswith("http") and not "google.com" in link:
                          # Prevent duplicate entries if multiple selectors matched the same DOM node
                          if not any(r["url"] == link for r in results):
                            results.append({"url": link, "title": title})

                          if len(results) >= max_results:
                            break

                    # Circuit Breaker: If iterating the page yielded no new valid links, we've hit the end of the SERP
                    if len(results) == initial_count:
                        break

                    # Increment index to fetch the next page of SERP results
                    start_index += 10
            except Exception as e:
                # Drop an audit log of the raw SERP DOM to debug layout changes or CAPTCHAs
                try:
                    from insetu.kernel.utils import get_workspace_physics
                    import time, os
                    cfg_path, _, _ = get_workspace_physics()
                    log_dir = Path(cfg_path).parent / "data" / "logs" / "research_dumps"
                    os.makedirs(log_dir.as_posix(), exist_ok=True)
                    dump_path = log_dir / f"google_serp_fail_{int(time.time())}.html"
                    dump_ctx = research_bp.get_context('default')
                    dump_ctx.vfs.save(dump_path.as_posix(), page.content(), data={"is_absolute_artifact": True})
                    print(f"  [!] SERP parsing failed. Raw HTML dumped to: {dump_path}")
                except Exception:
                    pass
                raise e
            finally:
                browser.close()
        return results
class SerperDevProvider(SearchProvider):
    def execute_search(self, query, max_results=10, date_range=None, start_index=0, workspace_id='default'):
        import urllib.error
        ctx = research_bp.get_context(workspace_id)

        api_key = ctx.settings.get("serper_api_key")

        if not api_key:
            raise Exception("Missing Serper API Key. Please add it via the Settings menu.")

        url = "https://google.serper.dev/search"

        # Serper maps start_index to 'page' (1-indexed)
        page = (start_index // 10) + 1
        payload = {
            "q": query,
            "page": page,
            "num": 10
        }

        if date_range:
            if date_range in ['d', 'w', 'm', 'y']:
                payload["tbs"] = f"qdr:{date_range}"
            elif ".." in date_range:
                try:
                    start, end = date_range.split("..")
                    s_parts, e_parts = start.split("-"), end.split("-")
                    if len(s_parts) == 3 and len(e_parts) == 3:
                        payload["tbs"] = f"cdr:1,cd_min:{s_parts[1]}/{s_parts[2]}/{s_parts[0]},cd_max:{e_parts[1]}/{e_parts[2]}/{e_parts[0]}"
                except Exception:
                    pass

        req = urllib.request.Request(url, headers={
            'X-API-KEY': api_key,
            'Content-Type': 'application/json'
        }, data=json.dumps(payload).encode('utf-8'))

        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise Exception("Invalid Serper.dev API Key. Please check your config.json.")
            raise Exception(f"Serper API request failed: HTTP {e.code}")
        except Exception as e:
            raise Exception(f"Serper API request failed: {str(e)}")

        results = []
        for item in data.get("organic", []):
            link = item.get("link")
            title = item.get("title", "Untitled")
            if link and link.startswith("http"):
                results.append({"url": link, "title": title})

        return results

def get_provider(provider_name):
    if provider_name == 'duckduckgo':
        return DuckDuckGoHTMLProvider()
    elif provider_name == 'google':
        return GooglePlaywrightProvider()
    elif provider_name == 'serper':
        return SerperDevProvider()
    raise ValueError(f"Unknown provider: {provider_name}")
# --- ASYNCHRONOUS EVENT LOOP (METRONOME DISPATCHER) ---
def gather_next_page(job_id, workspace_id=None):
  """Metronome callback to fetch a single SERP page, preventing rate limits."""
  import insetu.kernel.db as kernel_db
  ctx = research_bp.get_context(workspace_id)
  conn = ctx.db
  job = conn.execute("SELECT * FROM research_jobs WHERE id=?", (job_id,)).fetchone()

  if not job or job['status'] != 'gathering':
    w_conn = kernel_db.get_connection('workers', workspace_id=workspace_id)
    w_conn.execute("DELETE FROM jobs WHERE id=?", (f"research_gather_{job_id}",))
    w_conn.commit()
    return

  meta = json.loads(job['meta_json'])
  start_index = meta.get('start_index', 0)
  max_results = meta.get('max_results', 10)
  date_range = meta.get('date_range', '')
  try:
    provider = get_provider(job['provider'])
    links = provider.execute_search(job['query'], max_results=max_results, date_range=date_range, start_index=start_index, workspace_id=workspace_id)
    new_links_count = 0
    for link in links:
      exists = conn.execute("SELECT id FROM research_inbox WHERE job_id=? AND url=?", (job_id, link['url'])).fetchone()
      if not exists:
        prior_scrape = conn.execute("SELECT id FROM research_inbox WHERE url=? AND scraped_at IS NOT NULL", (link['url'],)).fetchone()
        prior_cit = None
        from insetu.kernel.utils import is_extension_enabled
        if is_extension_enabled("citations", workspace_id=workspace_id):
          try:
            from insetu.extensions.citations.engine_citations import citations_bp
            cit_ctx = citations_bp.get_context(workspace_id)
            cit_conn = cit_ctx.db
            # Utilize SQLite JSON1 extension to natively query the CSL-JSON matrix
            prior_cit = cit_conn.execute("SELECT id FROM citations WHERE json_extract(raw_json, '$.URL') = ?", (link['url'],)).fetchone()
          except Exception as e:
            print(f"⚠️ [Research] Citation check failed gracefully: {e}")

        inbox_status = 'pending'
        if prior_cit:
          inbox_status = 'in_library'
        elif prior_scrape:
          inbox_status = 'duplicate'

        inbox_id = str(uuid.uuid4())
        conn.execute("INSERT INTO research_inbox (id, job_id, url, title, status) VALUES (?, ?, ?, ?, ?)", (inbox_id, job_id, link['url'], link['title'], inbox_status))
        new_links_count += 1

    conn.execute("UPDATE research_jobs SET total_links = total_links + ? WHERE id=?", (new_links_count, job_id))
    current_total = conn.execute("SELECT total_links FROM research_jobs WHERE id=?", (job_id,)).fetchone()['total_links']
    if new_links_count == 0 or current_total >= max_results:
      conn.execute("UPDATE research_jobs SET status='paused' WHERE id=?", (job_id,))
      w_conn = kernel_db.get_connection('workers', workspace_id=workspace_id)
      w_conn.execute("DELETE FROM jobs WHERE id=?", (f"research_gather_{job_id}",))
      w_conn.commit()
    else:
      meta['start_index'] = start_index + 10
      conn.execute("UPDATE research_jobs SET meta_json=? WHERE id=?", (json.dumps(meta), job_id))

    conn.commit()
  except Exception as e:
      print(f"❌ [Research Gather] Failed: {e}")
      meta['error'] = str(e)
      conn.execute("UPDATE research_jobs SET status='failed', meta_json=? WHERE id=?", (json.dumps(meta), job_id))
      conn.commit()
      w_conn = kernel_db.get_connection('workers', workspace_id=workspace_id)
      w_conn.execute("DELETE FROM jobs WHERE id=?", (f"research_gather_{job_id}",))
      w_conn.commit()
def scrape_next_link(job_id, workspace_id=None):
    """Executes a single link scrape inside the centralized ThreadPool."""
    import insetu.kernel.db as kernel_db
    ctx = research_bp.get_context(workspace_id)
    conn = ctx.db

    job_status = conn.execute("SELECT status FROM research_jobs WHERE id=?", (job_id,)).fetchone()
    if not job_status or job_status['status'] in ('paused', 'cancelled', 'completed', 'failed'):
        # Terminate the job in the metronome ledger
        w_conn = kernel_db.get_connection('workers', workspace_id=workspace_id)
        w_conn.execute("DELETE FROM jobs WHERE id=?", (f"research_{job_id}",))
        w_conn.commit()
        return
    row = conn.execute("SELECT id, url FROM research_inbox WHERE job_id=? AND status='pending' AND scraped_at IS NULL LIMIT 1", (job_id,)).fetchone()
    if not row:
        pending_unreviewed = conn.execute("SELECT count(*) as c FROM research_inbox WHERE job_id=? AND status='pending'", (job_id,)).fetchone()['c']
        final_status = 'reviewed' if pending_unreviewed == 0 else 'completed'

        conn.execute("UPDATE research_jobs SET status=? WHERE id=?", (final_status, job_id,))
        conn.commit()
        w_conn = kernel_db.get_connection('workers', workspace_id=workspace_id)
        w_conn.execute("DELETE FROM jobs WHERE id=?", (f"research_{job_id}",))
        w_conn.commit()
        print(f"✅ [Research] Job {job_id} finished scraping (Status: {final_status}).")
        return
    inbox_id = row['id']
    target_url = row['url']

    print(f"🔍 [Research] Scraping: {target_url}")
    try:
      job_data = conn.execute("SELECT meta_json FROM research_jobs WHERE id=?", (job_id,)).fetchone()
      meta = json.loads(job_data['meta_json']) if job_data and job_data['meta_json'] else {}
      parser_type = meta.get('parser', 'jina')

      extracted = extract_markdown_from_url(target_url, method=parser_type)
      now_str = datetime.now().isoformat(timespec='seconds')
      conn.execute("UPDATE research_inbox SET raw_markdown=?, title=?, scraped_at=? WHERE id=?", (extracted["clean_markdown"], extracted["title"], now_str, inbox_id))
    except Exception as e:
        now_str = datetime.now().isoformat(timespec='seconds')
        conn.execute("UPDATE research_inbox SET raw_markdown=?, scraped_at=? WHERE id=?", (f"Extraction Error: {str(e)}", now_str, inbox_id))

    conn.execute("UPDATE research_jobs SET processed_links = processed_links + 1 WHERE id=?", (job_id,))
    conn.commit()

# Register the callback tightly with the central ledger
register_callback("research", "scrape_next_link", scrape_next_link)
register_callback("research", "gather_next_page", gather_next_page)
def _get_research_intervals():
    """Reads dynamic pacing configurations from the workspace config."""
    ctx = research_bp.get_context('default')
    cfg = ctx.config
    r_cfg = cfg.get("extension_config", {}).get("research", {})
    return (
        r_cfg.get("gather_interval_ms", 4000),
        r_cfg.get("gather_jitter_ms", 1500),
        r_cfg.get("scrape_interval_ms", 15000),
        r_cfg.get("scrape_jitter_ms", 5000)
    )

# --- API ENDPOINTS ---
@research_bp.route('start', methods=['POST'])
def start_job(ctx):
    workspace_id = ctx.workspace_id
    data = ctx.req.json
    query = data.get('query', '').strip()
    provider_name = data.get('provider', 'duckduckgo')
    max_results = int(data.get('max_results', 10))
    date_range = data.get('date_range', '').strip()
    parser = data.get('parser', 'jina')
    target_dir = data.get('target_dir', 'research/')

    if not query:
        return jsonify({"error": "Query required"}), 400

    job_id = str(uuid.uuid4())
    now_str = datetime.now().isoformat(timespec='seconds')
    try:
      meta_json = json.dumps({
        "start_index": 0,
        "max_results": max_results,
        "date_range": date_range,
        "parser": parser,
        "target_dir": target_dir
      })

      conn = ctx.db
      conn.execute("INSERT INTO research_jobs (id, query, provider, status, total_links, created_at, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (job_id, query, provider_name, 'gathering', 0, now_str, meta_json))
      conn.commit()
      g_int, g_jit, _, _ = _get_research_intervals()

      # Dispatch to Metronome: Fetch a SERP page dynamically to avoid rate limits
      submit_job(f"research_gather_{job_id}", "research", "gather_next_page", g_int, json.dumps({"job_id": job_id}), g_jit, workspace_id=workspace_id)

      # Return immediately so the UI doesn't hang
      return jsonify({"status": "success", "job_id": job_id, "message": "Gathering links asynchronously."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@research_bp.route('<job_id>/action', methods=['POST'])
def job_action(ctx, job_id):
    workspace_id = ctx.workspace_id
    data = ctx.req.json
    action = data.get('action') # 'pause', 'resume', 'cancel'

    conn = ctx.db
    job = conn.execute("SELECT status FROM research_jobs WHERE id=?", (job_id,)).fetchone()

    if not job:
        return jsonify({"error": "Job not found"}), 404

    current_status = job['status']

    if action == 'pause' and current_status == 'running':
        conn.execute("UPDATE research_jobs SET status='paused' WHERE id=?", (job_id,))
        conn.commit()
        # The Metronome will detect the paused status and self-terminate the ledger entry on its next execution
        return jsonify({"status": "success", "message": "Job paused"})
    elif action == 'cancel' and current_status in ('running', 'paused', 'gathering'):
        conn.execute("UPDATE research_jobs SET status='cancelled' WHERE id=?", (job_id,))
        conn.execute("DELETE FROM research_inbox WHERE job_id=?", (job_id,))
        conn.commit()
        return jsonify({"status": "success", "message": "Job cancelled"})
    elif action == 'resume' and current_status == 'paused':
        conn.execute("UPDATE research_jobs SET status='running' WHERE id=?", (job_id,))
        conn.commit()
        _, _, s_int, s_jit = _get_research_intervals()

        # Dispatch to the Metronome
        submit_job(f"research_{job_id}", "research", "scrape_next_link", s_int, json.dumps({"job_id": job_id}), s_jit, workspace_id=workspace_id)
        return jsonify({"status": "success", "message": "Job resumed"})
    elif action == 'update_meta':
        job_data = conn.execute("SELECT meta_json FROM research_jobs WHERE id=?", (job_id,)).fetchone()
        meta = json.loads(job_data['meta_json'] if job_data and job_data['meta_json'] else '{}')
        meta_updates = data.get('meta', {})
        meta.update(meta_updates)
        conn.execute("UPDATE research_jobs SET meta_json=? WHERE id=?", (json.dumps(meta), job_id))
        conn.commit()
        return jsonify({"status": "success", "message": "Metadata updated"})
    elif action == 'delete':
        conn.execute("DELETE FROM research_jobs WHERE id=?", (job_id,))
        conn.execute("DELETE FROM research_inbox WHERE job_id=?", (job_id,))
        conn.commit()

        import insetu.kernel.db as kernel_db
        w_conn = kernel_db.get_connection('workers', workspace_id=workspace_id)
        w_conn.execute("DELETE FROM jobs WHERE id IN (?, ?)", (f"research_{job_id}", f"research_gather_{job_id}"))
        w_conn.commit()

        return jsonify({"status": "success", "message": "Job permanently deleted"})

    elif action == 'retry' and current_status == 'failed':
        job_data = conn.execute("SELECT meta_json, total_links FROM research_jobs WHERE id=?", (job_id,)).fetchone()
        meta = json.loads(job_data['meta_json'] if job_data and job_data['meta_json'] else '{}')

        # Clear the error message from the state
        if 'error' in meta:
            del meta['error']

        # Determine which phase failed based on if we hit our target URL count
        max_results = meta.get('max_results', 10)
        target_status = 'gathering' if job_data['total_links'] < max_results else 'running'

        conn.execute("UPDATE research_jobs SET status=?, meta_json=? WHERE id=?", (target_status, json.dumps(meta), job_id))
        conn.commit()
        g_int, g_jit, s_int, s_jit = _get_research_intervals()

        if target_status == 'gathering':
            submit_job(f"research_gather_{job_id}", "research", "gather_next_page", g_int, json.dumps({"job_id": job_id}), g_jit, workspace_id=workspace_id)
        else:
            submit_job(f"research_{job_id}", "research", "scrape_next_link", s_int, json.dumps({"job_id": job_id}), s_jit, workspace_id=workspace_id)

        return jsonify({"status": "success", "message": f"Job retrying in {target_status} phase"})

    return jsonify({"error": f"Invalid transition from {current_status} to {action}"}), 400
@research_bp.route('jobs', methods=['GET'])
def list_jobs(ctx):
    jobs = ctx.db.get_all("research_jobs", order_by="created_at DESC")
    return jsonify({"jobs": jobs})
@research_bp.route('inbox', methods=['GET'])
def list_inbox(ctx):
    status_filter = ctx.req.args.get('status', 'pending')
    statuses = tuple(status_filter.split(','))
    conn = ctx.db
    placeholders = ','.join(['?'] * len(statuses))
    cursor = conn.execute(f"SELECT * FROM research_inbox WHERE status IN ({placeholders})", statuses)
    items = [dict(row) for row in cursor.fetchall()]
    return jsonify({"items": items})
@research_bp.worker("export_context_task")
def _background_export_context(ctx, research_job_id):
    from insetu.kernel.workers import register_ephemeral_artifact
    from pathlib import Path

    ctx.jobs.update_progress("Compiling research context...")
    conn = ctx.db
    cursor = conn.execute("SELECT id, title, raw_markdown FROM research_inbox WHERE job_id=? AND status='pending' AND scraped_at IS NOT NULL", (research_job_id,))
    items = cursor.fetchall()

    chunks = []
    current_chunk = ""
    max_size = 250000

    for item in items:
        content = item['raw_markdown'] if item['raw_markdown'] else "No content extracted."
        doc_str = f"<document id=\"{item['id']}\">\n# {item['title']}\n{content}\n</document>\n\n"

        if len(current_chunk) + len(doc_str) > max_size and current_chunk:
            chunks.append(current_chunk)
            current_chunk = doc_str
        else:
            current_chunk += doc_str

    if current_chunk:
        chunks.append(current_chunk)

    if not chunks:
        raise ValueError("No fully scraped pending links available to pack.")
    artifacts = []
    for i, chunk in enumerate(chunks):
        filename = f"context_{research_job_id[:8]}_part_{i+1}.txt"
        out_path = Path(ctx.paths["artifacts_base"]).joinpath(filename).as_posix()
        ctx.vfs.save(out_path, chunk, data={"is_absolute_artifact": True})
        register_ephemeral_artifact(out_path, "research", 3600, workspace_id=ctx.workspace_id)
        artifacts.append({"filename": filename, "download_url": f"/download/{filename}"})

    return {"message": "Context packed.", "artifact": {"files": artifacts}}

@research_bp.route('<job_id>/export_context', methods=['POST'])
def export_context(ctx, job_id):
    jid = ctx.jobs.submit("export_context_task", research_job_id=job_id)
    return jsonify({"status": "accepted", "job_id": jid}), 202
@research_bp.route('inbox/<inbox_id>/disposition', methods=['POST'])
def inbox_disposition(ctx, inbox_id):
    workspace_id = ctx.workspace_id
    data = ctx.req.json
    status = data.get('status')
    if status not in ('accepted', 'rejected', 'force_scrape'):
        return jsonify({"error": "Invalid status"}), 400

    conn = ctx.db
    if status == 'force_scrape':
        conn.execute("UPDATE research_inbox SET status='pending', scraped_at=NULL, raw_markdown=NULL WHERE id=?", (inbox_id,))
        job_data = conn.execute("SELECT job_id FROM research_inbox WHERE id=?", (inbox_id,)).fetchone()
        if job_data:
            job_id = job_data['job_id']
            conn.execute("UPDATE research_jobs SET status='running' WHERE id=? AND status='completed'", (job_id,))
            conn.commit()
            from insetu.engine_research import _get_research_intervals
            _, _, s_int, s_jit = _get_research_intervals()
            submit_job(f"research_{job_id}", "research", "scrape_next_link", s_int, json.dumps({"job_id": job_id}), s_jit, workspace_id=workspace_id)
        return jsonify({"status": "success"})
    conn.execute("UPDATE research_inbox SET status=? WHERE id=?", (status, inbox_id))

    # Check if this disposition empties the triage queue for a completed job
    job_data = conn.execute("SELECT job_id FROM research_inbox WHERE id=?", (inbox_id,)).fetchone()
    if job_data:
        job_id = job_data['job_id']
        job = conn.execute("SELECT status FROM research_jobs WHERE id=?", (job_id,)).fetchone()
        if job and job['status'] == 'completed':
            pending = conn.execute("SELECT count(*) as c FROM research_inbox WHERE job_id=? AND status='pending'", (job_id,)).fetchone()['c']
            if pending == 0:
                conn.execute("UPDATE research_jobs SET status='reviewed' WHERE id=?", (job_id,))

    conn.commit()
    return jsonify({"status": "success"})