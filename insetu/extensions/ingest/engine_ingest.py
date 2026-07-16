import urllib.request
import urllib.parse
import uuid
import json
from flask import jsonify
from insetu.sdk import InSetuExtension
from insetu.workers import submit_immediate_job, update_immediate_job_status, register_callback
ingest_bp = InSetuExtension('ingest', __name__, title="URL Ingestion", description="Webpage fetching and Markdown conversion.")
__depends__ = []

def _background_ingest(job_id, workspace_id, url, method):
    try:
        update_immediate_job_status(job_id, 'processing', 'Fetching and converting URL content...', workspace_id=workspace_id)
        extracted = extract_markdown_from_url(url, method)
        safe_title = extracted["title"].replace('"', "'")
        update_immediate_job_status(
            job_id, 
            'completed', 
            'Ingestion successful.', 
            artifact={
                "markdown": extracted["clean_markdown"],
                "title": safe_title,
                "resolved_url": extracted["resolved_url"]
            }, 
            workspace_id=workspace_id
        )
    except Exception as e:
        update_immediate_job_status(job_id, 'failed', f"Ingestion failed: {str(e)}", workspace_id=workspace_id)

register_callback("ingest", "ingest_task", _background_ingest)

def extract_markdown_from_url(target_url, method="jina"):
    # Intercept and unwrap Google search redirect links
    parsed_url = urllib.parse.urlparse(target_url)
    if 'google.com' in parsed_url.netloc and parsed_url.path == '/url':
        qs = urllib.parse.parse_qs(parsed_url.query)
        if 'q' in qs:
            target_url = qs['q'][0]
        elif 'url' in qs:
            target_url = qs['url'][0]
            
    extracted_title = "Imported Content"
    extracted_url = target_url
    published_time = "Unknown"
    clean_markdown = ""

    if method == "bs4":
        try:
            from bs4 import BeautifulSoup
            import markdownify
        except ImportError:
            raise Exception("Missing optional dependencies for local parsing. Please install them via: pip install beautifulsoup4 markdownify")
        req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate'})
        with urllib.request.urlopen(req) as response:
            raw_data = response.read()
            encoding = response.info().get('Content-Encoding', '').lower()
            if encoding == 'gzip':
                import gzip
                raw_data = gzip.decompress(raw_data)
            elif encoding == 'deflate':
                import zlib
                raw_data = zlib.decompress(raw_data)
            html_content = raw_data.decode('utf-8', errors='ignore')

        soup = BeautifulSoup(html_content, 'html.parser')
        if soup.title and soup.title.string:
            extracted_title = soup.title.string.strip()

        # Remove scripts, styles, and other layout clutter
        for element in soup(["script", "style", "nav", "footer", "iframe", "header", "aside"]):
            element.decompose()

        # Attempt to target the main article container to reduce noise, fallback to body
        main_content = soup.find('article') or soup.find('main') or soup.body
        if main_content:
            clean_markdown = markdownify.markdownify(str(main_content), heading_style="ATX").strip()
        else:
            clean_markdown = markdownify.markdownify(html_content, heading_style="ATX").strip()

    else:
        # Use Jina Reader API to cleanly convert HTML to Markdown without heavy local dependencies
        req = urllib.request.Request(f"https://r.jina.ai/{target_url}", headers={'User-Agent': 'inSetu-OS/1.0', 'Accept-Encoding': 'gzip, deflate'})
        with urllib.request.urlopen(req) as response:
            raw_data = response.read()
            encoding = response.info().get('Content-Encoding', '').lower()
            if encoding == 'gzip':
                import gzip
                raw_data = gzip.decompress(raw_data)
            elif encoding == 'deflate':
                import zlib
                raw_data = zlib.decompress(raw_data)
            markdown_content = raw_data.decode('utf-8', errors='ignore')

        # Parse Jina's header block
        lines = markdown_content.splitlines()

        content_start_idx = 0
        for i, line in enumerate(lines[:30]):
            if line.startswith("Title: "):
                extracted_title = line.replace("Title: ", "").strip()
            elif line.startswith("URL Source: "):
                extracted_url = line.replace("URL Source: ", "").strip()
            elif line.startswith("Published Time: "):
                published_time = line.replace("Published Time: ", "").strip()
            elif line.startswith("Markdown Content:"):
                content_start_idx = i + 1
                break

        if content_start_idx > 0:
            clean_markdown = "\n".join(lines[content_start_idx:]).lstrip()
        else:
            clean_markdown = markdown_content
        # Fallback title extraction if Jina changes format
        first_line = clean_markdown.lstrip().split('\n')[0]
        if first_line.startswith('# '):
            extracted_title = first_line[2:].strip()

    import datetime
    now_str = datetime.datetime.now().isoformat(timespec='seconds')
    safe_title = extracted_title.replace('"', "'")
    # Binary/Garbage heuristics detection
    garbage_ratio = sum(1 for c in clean_markdown if ord(c) < 32 and c not in '\n\r\t') / max(len(clean_markdown), 1)
    if garbage_ratio > 0.01 or '\x00' in clean_markdown:
        clean_markdown = "> **[inSetu Engine Warning]** This file appears to contain compressed binary data or failed to decode cleanly. You may want to Re-Scrape or manually verify the source URL.\n\n" + clean_markdown

    yaml_frontmatter = (
        f"---\n"
        f"title: \"{safe_title}\"\n"
        f"source_url: \"{extracted_url}\"\n"
        f"published_at: \"{published_time}\"\n"
        f"imported_at: \"{now_str}\"\n"
        f"---\n\n"
        f"## Notes\n\n\n"
        f"---\n\n"
    )
    final_markdown = yaml_frontmatter + clean_markdown
    return {
        "title": extracted_title,
        "resolved_url": extracted_url,
        "published_time": published_time,
        "clean_markdown": final_markdown
    }
@ingest_bp.route('url', methods=['POST'])
def api_ingest_url(ctx):
    data = ctx.req.json or {}
    target_url = data.get("url", "").strip()
    if not target_url: return jsonify({"error": "URL is required"}), 400

    job_id = ctx.jobs.submit("ingest_task", url=target_url, method=data.get("method", "jina"))
    return jsonify({"status": "accepted", "job_id": job_id}), 202