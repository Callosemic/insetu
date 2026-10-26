import datetime
import gzip
import zlib
import urllib.request
import urllib.parse
import uuid
import json
from typing import TypedDict, Optional
from insetu.core.sdk import InSetuExtension
ingest_bp = InSetuExtension(
    'ingest',
    __name__,
    title="URL Ingestion",
    description="Webpage fetching and Markdown conversion.",
    external_dependencies=["beautifulsoup4", "markdownify"],
)
__depends__ = []
@ingest_bp.worker("ingest_task")
def _background_ingest(ctx, url: str, method: str = "jina"):
    ctx.jobs.update_progress('Fetching and converting URL content...')
    extracted = extract_markdown_from_url(ctx, url, method)
    safe_title = extracted["title"].replace('"', "'")
    return {
        "message": "Ingestion successful.", 
        "artifact": {
            "markdown": extracted["clean_markdown"],
            "title": safe_title,
            "resolved_url": extracted["resolved_url"]
        }
    }

def extract_markdown_from_url(ctx, target_url, method="jina"):
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
            from bs4 import BeautifulSoup as _BeautifulSoup
            import markdownify as _markdownify
        except ImportError:
            raise Exception("Missing optional dependencies for local parsing. Please install them via: pip install beautifulsoup4 markdownify")
        req = urllib.request.Request(target_url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate'})
        with urllib.request.urlopen(req) as response:
            raw_data = response.read()
            encoding = response.info().get('Content-Encoding', '').lower()
            if encoding == 'gzip':
                raw_data = gzip.decompress(raw_data)
            elif encoding == 'deflate':
                raw_data = zlib.decompress(raw_data)
            html_content = raw_data.decode('utf-8', errors='ignore')

        soup = _BeautifulSoup(html_content, 'html.parser')
        if soup.title and soup.title.string:
            extracted_title = soup.title.string.strip()

        # Remove scripts, styles, and other layout clutter
        for element in soup(["script", "style", "nav", "footer", "iframe", "header", "aside"]):
            element.decompose()

        # Attempt to target the main article container to reduce noise, fallback to body
        main_content = soup.find('article') or soup.find('main') or soup.body
        if main_content:
            clean_markdown = _markdownify.markdownify(str(main_content), heading_style="ATX").strip()
        else:
            clean_markdown = _markdownify.markdownify(html_content, heading_style="ATX").strip()

    else:
        # Use Jina Reader API to cleanly convert HTML to Markdown without heavy local dependencies
        req = urllib.request.Request(f"https://r.jina.ai/{target_url}", headers={'User-Agent': 'inSetu-OS/1.0', 'Accept-Encoding': 'gzip, deflate'})
        with urllib.request.urlopen(req) as response:
            raw_data = response.read()
            encoding = response.info().get('Content-Encoding', '').lower()
            if encoding == 'gzip':
                raw_data = gzip.decompress(raw_data)
            elif encoding == 'deflate':
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

    now_str = datetime.datetime.now().isoformat(timespec='seconds')
    safe_title = extracted_title.replace('"', "'")
    # Binary/Garbage heuristics detection
    garbage_ratio = sum(1 for c in clean_markdown if ord(c) < 32 and c not in '\n\r\t') / max(len(clean_markdown), 1)
    if garbage_ratio > 0.01 or '\x00' in clean_markdown:
        clean_markdown = "> **[inSetu Engine Warning]** This file appears to contain compressed binary data or failed to decode cleanly. You may want to Re-Scrape or manually verify the source URL.\n\n" + clean_markdown

    yaml_data = {
        "title": safe_title,
        "source_url": extracted_url,
        "published_at": published_time,
        "imported_at": now_str
    }
    raw_content = f"## Notes\n\n\n---\n\n{clean_markdown}"
    final_markdown = ctx.update_frontmatter(raw_content, yaml_data)

    return {
        "title": extracted_title,
        "resolved_url": extracted_url,
        "published_time": published_time,
        "clean_markdown": final_markdown
    }
class IngestUrlPayload(TypedDict, total=False):
    url: str
    method: Optional[str]
@ingest_bp.route('url', methods=['POST'], request_schema=IngestUrlPayload, docstring="Fetches content from a URL and converts it into clean Markdown.")
def api_ingest_url(ctx):
    """Fetches content from a URL and converts it into clean Markdown."""
    data = ctx.payload or {}
    target_url = str(data.get("url") or "").strip()
    if not target_url: return {"error": "URL is required"}, 400

    job_id = ctx.jobs.submit("ingest_task", url=target_url, method=data.get("method", "jina"), job_category="ui_blocking")
    return {"status": "accepted", "job_id": job_id}, 202