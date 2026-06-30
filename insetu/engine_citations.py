import os
import json
import sqlite3
import urllib.request
import urllib.parse
from flask import Blueprint, request, jsonify
from insetu.engine_gather import ARTIFACTS_BASE
from insetu.hooks import hooks

citations_bp = Blueprint('citations', __name__)
@hooks.on('mutate_workspace_config')
def inject_citation_metadata(cfg):
    """Dynamically injects virtual UI metadata for citation payloads."""
    if "citations" not in cfg.get("extensions", []): return

    targets = cfg.get("target_repos", [])

    # Prevent duplication across in-memory cache loads
    if any(r.get("repo_dir") == "virtual_citations" for r in targets):
        return

    # Inject the Global Library mapping
    targets.append({
        "repo_dir": "virtual_citations",
        "title": "Global Reference Library",
        "domain": "Reference Library",
        "description": "Academic citations and bibliography records.",
        "out_file": "citations_context.txt",
        "exclude_from_context": True,
        "exclude_from_diffs": True,
        "exclude_from_tracker": True
    })

    # Dynamically inject mappings for repo-specific citation buckets
    try:
        import sqlite3, os, json
        db_path = os.path.join(ARTIFACTS_BASE, "citations.db")
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cursor = conn.execute("SELECT attachments FROM citations WHERE attachments != '[]'")
            citation_scopes = set()
            for row in cursor.fetchall():
                atts = json.loads(row[0])
                for att in atts:
                    repo = att.get('repo')
                    bucket = att.get('bucket', 'None')
                    if repo: 
                        citation_scopes.add((repo, None))
                        if bucket and bucket != "None":
                            citation_scopes.add((repo, bucket))

            for repo, bucket in citation_scopes:
                if bucket:
                    virtual_dir = f"virtual_citations_{repo}_{bucket}"
                    ui_title = f"{repo}/{bucket}"
                    out_file = f"{repo}_{bucket}_citations_context.txt"
                else:
                    virtual_dir = f"virtual_citations_{repo}"
                    ui_title = repo
                    out_file = f"{repo}_citations_context.txt"

                if not any(t.get("repo_dir") == virtual_dir for t in targets):
                    targets.append({
                        "repo_dir": virtual_dir,
                        "title": ui_title,
                        "description": f"Academic citations scoped to {ui_title}.",
                        "domain": "Reference Library",
                        "out_file": out_file,
                        "exclude_from_context": True,
                        "exclude_from_diffs": True,
                        "exclude_from_tracker": True
                    })
            conn.close()
    except Exception:
        pass
_METADATA_CACHE = {"publications": [], "authors": []}
_METADATA_INITIALIZED = False

def _rebuild_metadata_cache():
    global _METADATA_CACHE, _METADATA_INITIALIZED
    try:
        conn = get_db()
        cursor = conn.execute("SELECT raw_json FROM citations")
        pubs = set()
        authors = set()
        for row in cursor.fetchall():
            item = json.loads(row['raw_json'])
            if item.get('container-title'):
                pubs.add(item['container-title'])
            for a in item.get('author', []):
                if a.get('family') and a.get('given'):
                    authors.add(f"{a['family']}, {a['given']}")
                elif a.get('family'):
                    authors.add(a['family'])

        _METADATA_CACHE = {
            "publications": sorted(list(pubs)), 
            "authors": sorted(list(authors))
        }
        _METADATA_INITIALIZED = True
    except Exception:
        pass

def get_db():
    db_path = os.path.join(ARTIFACTS_BASE, "citations.db")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS citations (
            id TEXT PRIMARY KEY,
            type TEXT,
            title TEXT,
            raw_json TEXT,
            attachments TEXT DEFAULT '[]'
        )
    """)
    try:
        conn.execute("ALTER TABLE citations ADD COLUMN attachments TEXT DEFAULT '[]'")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    return conn
@citations_bp.route('/api/citations/index', methods=['GET'])
def get_metadata_index():
    global _METADATA_CACHE, _METADATA_INITIALIZED
    if not _METADATA_INITIALIZED:
        _rebuild_metadata_cache()
    return jsonify(_METADATA_CACHE)

@citations_bp.route('/api/citations', methods=['GET'])
def get_citations():
    try:
        conn = get_db()
        cursor = conn.execute("SELECT raw_json, attachments FROM citations ORDER BY id ASC")
        items = []
        for row in cursor.fetchall():
            item = json.loads(row['raw_json'])
            item['_attachments'] = json.loads(row['attachments']) if row['attachments'] else []
            items.append(item)
        return jsonify({"citations": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@citations_bp.route('/api/citations/<path:csl_id>/attach', methods=['POST'])
def attach_citation(csl_id):
    data = request.json
    attachments = data.get("attachments", [])
    try:
        conn = get_db()
        conn.execute("UPDATE citations SET attachments = ? WHERE id = ?", (json.dumps(attachments), csl_id))
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@citations_bp.route('/api/citations/search', methods=['GET'])
def search_global_citations():
    query = request.args.get('q', '').strip()
    source = request.args.get('source', 'openalex').strip()
    field = request.args.get('field', 'all').strip()
    category = request.args.get('category', '').strip()

    try:
        page = int(request.args.get('page', 1))
    except ValueError:
        page = 1

    if not query and not category:
        return jsonify({"citations": []})

    try:
        safe_query = urllib.parse.quote(query) if query else ""
        csl_items = []
        offset = (page - 1) * 20

        if source == 'crossref':
            if field == 'title' and safe_query:
                url = f"https://api.crossref.org/works?query.title={safe_query}&rows=20&offset={offset}"
            elif safe_query:
                url = f"https://api.crossref.org/works?query={safe_query}&rows=20&offset={offset}"
            else:
                return jsonify({"citations": []})

            req = urllib.request.Request(url, headers={'User-Agent': 'mailto:insetu-dev@localhost'})
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
            for item in data.get('message', {}).get('items', []):
                csl_items.append({
                    "id": item.get('DOI', item.get('id', 'unknown')),
                    "title": item.get('title', ['Untitled'])[0] if item.get('title') else 'Untitled',
                    "type": item.get('type', 'article-journal'),
                    "author": item.get('author', [{"family": "Unknown"}]),
                    "issued": item.get('issued', {"date-parts": [["n.d."]]})
                })
        elif source == 'semanticscholar':
            if not safe_query: return jsonify({"citations": []})
            url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={safe_query}&limit=20&offset={offset}&fields=title,authors,year,externalIds,isOpenAccess"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
            for item in data.get('data', []):
                csl_items.append({
                    "id": item.get('externalIds', {}).get('DOI', item.get('paperId', 'unknown')),
                    "title": item.get('title', 'Untitled'),
                    "type": "article",
                    "author": [{"family": a.get('name', '')} for a in item.get('authors', [])],
                    "issued": {"date-parts": [[item.get('year', 'n.d.')]]},
                    "open_access": item.get('isOpenAccess', False)
                })

        else: # Default to OpenAlex
            filters = []
            if category:
                safe_cat = urllib.parse.quote(category)
                cat_url = f"https://api.openalex.org/topics?search={safe_cat}&per-page=1"
                try:
                    cat_req = urllib.request.Request(cat_url, headers={'User-Agent': 'mailto:insetu-dev@localhost'})
                    with urllib.request.urlopen(cat_req) as cr:
                        cat_data = json.loads(cr.read().decode())
                        if cat_data.get('results'):
                            topic_id = cat_data['results'][0]['id'].split('/')[-1]
                            filters.append(f"topics.id:{topic_id}")
                except Exception:
                    pass
            if field == 'title' and safe_query:
                filters.append(f"title.search:{safe_query}")

            url = f"https://api.openalex.org/works?per-page=20&page={page}"
            if filters:
                url += f"&filter={','.join(filters)}"
            if field != 'title' and safe_query:
                url += f"&search={safe_query}"

            req = urllib.request.Request(url, headers={'User-Agent': 'mailto:insetu-dev@localhost'})
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
            for work in data.get('results', []):
                csl_items.append({
                    "id": work.get('id', '').split('/')[-1],
                    "title": work.get('title', 'Untitled'),
                    "type": work.get('type', 'article'),
                    "author": [{"family": a.get('author', {}).get('display_name', '')} for a in work.get('authorships', [])],
                    "issued": {"date-parts": [[work.get('publication_year', 'n.d.')]]},
                    "open_access": work.get('open_access', {}).get('is_oa', False)
                })

        return jsonify({"citations": csl_items})
    except Exception as e:
        return jsonify({"error": f"Catalog Search Failed ({source}): {str(e)}"}), 500

@citations_bp.route('/api/citations/import', methods=['POST'])
def import_citations():
    data = request.json
    if not data:
        return jsonify({"error": "Missing JSON payload"}), 400
        
    strategy = data.get("strategy", "overwrite") # overwrite, skip, or manual
    items = data.get("citations", []) if isinstance(data, dict) and "citations" in data else data

    if not isinstance(items, list):
        return jsonify({"error": "Invalid format. Expecting array of CSL-JSON objects."}), 400

    try:
        conn = get_db()
        count = 0
        conflicts = []
        
        for item in items:
            csl_id = item.get("id")
            if not csl_id: continue
            # Check for existing record
            existing = conn.execute("SELECT id, attachments FROM citations WHERE id = ?", (csl_id,)).fetchone()
            atts = '[]'

            if existing:
                atts = existing['attachments']
                if strategy == "skip":
                    continue
                elif strategy == "manual":
                    conflicts.append(item)
                    continue

            # Overwrite or insert new, preserving attachments
            csl_type = item.get("type", "unknown")
            csl_title = item.get("title", "Untitled Reference")
            conn.execute(
                "INSERT OR REPLACE INTO citations (id, type, title, raw_json, attachments) VALUES (?, ?, ?, ?, ?)",
                (str(csl_id), str(csl_type), str(csl_title), json.dumps(item), atts)
            )
            count += 1
        conn.commit()

        _rebuild_metadata_cache()

        return jsonify({
            "status": "success",  
            "imported": count, 
            "conflicts": conflicts,
            "message": f"Successfully integrated {count} records."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@citations_bp.route('/api/citations/<path:csl_id>', methods=['DELETE'])
def delete_citation(csl_id):
    try:
        conn = get_db()
        cursor = conn.execute("DELETE FROM citations WHERE id = ?", (csl_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Citation not found"}), 404
        conn.commit()

        _rebuild_metadata_cache()

        return jsonify({"status": "success", "message": f"Deleted citation {csl_id}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500