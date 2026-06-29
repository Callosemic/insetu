import os
import sqlite3
import uuid
from datetime import datetime
import urllib.request
import urllib.parse
from flask import Blueprint, request, jsonify
from insetu.engine_gather import ARTIFACTS_BASE
from insetu.utils_scraping import extract_markdown_from_url

research_bp = Blueprint('research', __name__)

def get_research_db():
    """Initializes and returns the connection to the localized research database."""
    db_path = os.path.join(ARTIFACTS_BASE, "research.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    conn.execute("""
        CREATE TABLE IF NOT EXISTS research_jobs (
            id TEXT PRIMARY KEY,
            query TEXT,
            provider TEXT,
            status TEXT,
            total_links INTEGER DEFAULT 0,
            processed_links INTEGER DEFAULT 0,
            created_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS research_inbox (
            id TEXT PRIMARY KEY,
            job_id TEXT,
            url TEXT,
            title TEXT,
            raw_markdown TEXT,
            status TEXT,
            scraped_at TEXT,
            FOREIGN KEY(job_id) REFERENCES research_jobs(id)
        )
    """)
    conn.commit()
    return conn

# --- SEARCH STRATEGY PATTERN ---

class SearchProvider:
    def execute_search(self, query, max_results=10, date_range=None):
        raise NotImplementedError

class DuckDuckGoHTMLProvider(SearchProvider):
    def execute_search(self, query, max_results=10, date_range=None):
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
    def execute_search(self, query, max_results=10, date_range=None):
        raise NotImplementedError("Google Playwright Provider is a future stub.")
def get_provider(provider_name):
                if provider_name == 'duckduckgo':
                                return DuckDuckGoHTMLProvider()
                elif provider_name == 'google':
                                return GooglePlaywrightProvider()
                raise ValueError(f"Unknown provider: {provider_name}")

# --- ASYNCHRONOUS EVENT LOOP (PACING & INTERRUPTION) ---
import threading

ACTIVE_JOBS = {}

def paced_worker(job_id):
                conn = get_research_db()
                try:
                                while True:
                                                # Check for external interruption (Pause/Cancel)
                                                if job_id in ACTIVE_JOBS and ACTIVE_JOBS[job_id].is_set():
                                                                job_status = conn.execute("SELECT status FROM research_jobs WHERE id=?", (job_id,)).fetchone()
                                                                if job_status and job_status['status'] in ('paused', 'cancelled'):
                                                                                print(f"🛑 [Research] Job {job_id} interrupted ({job_status['status']}). Exiting worker.")
                                                                                break
                                                                ACTIVE_JOBS[job_id].clear() # Reset if false alarm

                                                # Fetch next pending URL
                                                row = conn.execute("SELECT id, url FROM research_inbox WHERE job_id=? AND scraped_at IS NULL LIMIT 1", (job_id,)).fetchone()
                                                if not row:
                                                                conn.execute("UPDATE research_jobs SET status='completed' WHERE id=?", (job_id,))
                                                                conn.commit()
                                                                if job_id in ACTIVE_JOBS:
                                                                                del ACTIVE_JOBS[job_id]
                                                                print(f"✅ [Research] Job {job_id} completed.")
                                                                break

                                                inbox_id = row['id']
                                                target_url = row['url']

                                                print(f"🔍 [Research] Scraping: {target_url}")
                                                try:
                                                                extracted = extract_markdown_from_url(target_url, method="jina")
                                                                now_str = datetime.now().isoformat(timespec='seconds')
                                                                conn.execute("UPDATE research_inbox SET raw_markdown=?, title=?, scraped_at=? WHERE id=?", 
                                                                                                                (extracted["clean_markdown"], extracted["title"], now_str, inbox_id))
                                                except Exception as e:
                                                                now_str = datetime.now().isoformat(timespec='seconds')
                                                                conn.execute("UPDATE research_inbox SET raw_markdown=?, scraped_at=? WHERE id=?", 
                                                                                                                (f"Extraction Error: {str(e)}", now_str, inbox_id))

                                                conn.execute("UPDATE research_jobs SET processed_links = processed_links + 1 WHERE id=?", (job_id,))
                                                conn.commit()

                                                # Low and slow pacing to prevent blocking/rate limits
                                                if job_id in ACTIVE_JOBS:
                                                                ACTIVE_JOBS[job_id].wait(timeout=15.0)

                except Exception as e:
                                conn.execute("UPDATE research_jobs SET status='failed' WHERE id=?", (job_id,))
                                conn.commit()
                                print(f"❌ [Research] Worker thread failed for {job_id}: {str(e)}")
                finally:
                                conn.close()

# --- API ENDPOINTS ---
@research_bp.route('/api/research/start', methods=['POST'])
def start_job():
                data = request.json
                query = data.get('query', '').strip()
                provider_name = data.get('provider', 'duckduckgo')
                max_results = int(data.get('max_results', 10))
                date_range = data.get('date_range', '').strip()

                if not query:
                                return jsonify({"error": "Query required"}), 400

                job_id = str(uuid.uuid4())
                now_str = datetime.now().isoformat(timespec='seconds')

                try:
                                # Phase 2: Synchronous Provider link discovery
                                provider = get_provider(provider_name)
                                links = provider.execute_search(query, max_results=max_results, date_range=date_range)

                                conn = get_research_db()
                                conn.execute("INSERT INTO research_jobs (id, query, provider, status, total_links, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                                                                                    (job_id, query, provider_name, 'paused', len(links), now_str))

                                for link in links:
                                                inbox_id = str(uuid.uuid4())
                                                conn.execute("INSERT INTO research_inbox (id, job_id, url, title, status) VALUES (?, ?, ?, ?, ?)",
                                                                                                    (inbox_id, job_id, link['url'], link['title'], 'pending'))

                                conn.commit()
                                conn.close()

                                # Job starts paused to allow the user to triage/reject URLs before committing to the scrape
                                return jsonify({"status": "success", "job_id": job_id, "total_links": len(links)})
                except Exception as e:
                                return jsonify({"error": str(e)}), 500

@research_bp.route('/api/research/<job_id>/action', methods=['POST'])
def job_action(job_id):
                data = request.json
                action = data.get('action') # 'pause', 'resume', 'cancel'

                conn = get_research_db()
                job = conn.execute("SELECT status FROM research_jobs WHERE id=?", (job_id,)).fetchone()

                if not job:
                                return jsonify({"error": "Job not found"}), 404

                current_status = job['status']

                if action == 'pause' and current_status == 'running':
                                conn.execute("UPDATE research_jobs SET status='paused' WHERE id=?", (job_id,))
                                conn.commit()
                                if job_id in ACTIVE_JOBS:
                                                ACTIVE_JOBS[job_id].set() # Wake thread so it instantly exits
                                return jsonify({"status": "success", "message": "Job paused"})

                elif action == 'cancel' and current_status in ('running', 'paused'):
                                conn.execute("UPDATE research_jobs SET status='cancelled' WHERE id=?", (job_id,))
                                conn.commit()
                                if job_id in ACTIVE_JOBS:
                                                ACTIVE_JOBS[job_id].set()
                                return jsonify({"status": "success", "message": "Job cancelled"})

                elif action == 'resume' and current_status == 'paused':
                                conn.execute("UPDATE research_jobs SET status='running' WHERE id=?", (job_id,))
                                conn.commit()

                                ACTIVE_JOBS[job_id] = threading.Event()
                                threading.Thread(target=paced_worker, args=(job_id,), daemon=True).start()
                                return jsonify({"status": "success", "message": "Job resumed"})

                return jsonify({"error": f"Invalid transition from {current_status} to {action}"}), 400

@research_bp.route('/api/research/jobs', methods=['GET'])
def list_jobs():
                conn = get_research_db()
                cursor = conn.execute("SELECT * FROM research_jobs ORDER BY created_at DESC")
                jobs = [dict(row) for row in cursor.fetchall()]
                conn.close()
                return jsonify({"jobs": jobs})
@research_bp.route('/api/research/inbox', methods=['GET'])
def list_inbox():
                status_filter = request.args.get('status', 'pending')
                conn = get_research_db()
                cursor = conn.execute("SELECT * FROM research_inbox WHERE status=? ORDER BY scraped_at DESC", (status_filter,))
                items = [dict(row) for row in cursor.fetchall()]
                conn.close()
                return jsonify({"items": items})

@research_bp.route('/api/research/inbox/<inbox_id>/disposition', methods=['POST'])
def inbox_disposition(inbox_id):
                data = request.json
                status = data.get('status')
                if status not in ('accepted', 'rejected'):
                                return jsonify({"error": "Invalid status"}), 400

                conn = get_research_db()
                conn.execute("UPDATE research_inbox SET status=? WHERE id=?", (status, inbox_id))
                conn.commit()
                conn.close()
                return jsonify({"status": "success"})