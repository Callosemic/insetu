from pathlib import Path
import os
import json
import urllib.request
import urllib.parse
from flask import request, jsonify
from insetu.sdk import InSetuExtension
from insetu.hooks import hooks
CITATIONS_SCHEMA = {
    "citations": {
        "id": "TEXT PRIMARY KEY",
        "type": "TEXT",
        "title": "TEXT",
        "raw_json": "TEXT",
        "attachments": "TEXT DEFAULT '[]'"
    }
}

citations_bp = InSetuExtension('citations', __name__, schema=CITATIONS_SCHEMA, virtual_contexts=[{
    "title": "Global Reference Library",
    "domain": "Reference Library",
    "description": "Academic citations and bibliography records.",
    "out_file": "citations_context.txt"
}])
__depends__ = []

@hooks.on('mutate_workspace_config')
def inject_citation_metadata(cfg, workspace_id=None, **kwargs):
    """Dynamically injects virtual UI metadata for citation payloads."""
    if "citations" not in cfg.get("extensions", []): return
    if "virtual_contexts" not in cfg:
        cfg["virtual_contexts"] = []
    v_ctxs = cfg["virtual_contexts"]

    # Dynamically inject mappings for repo-specific citation buckets
    try:
        from insetu.db import get_connection
        conn = get_connection("citations", workspace_id=workspace_id)
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
            if not any(v.get("out_file") == out_file for v in v_ctxs):
                v_ctxs.append({
                    "title": ui_title,
                    "description": f"Academic citations scoped to {ui_title}.",
                    "domain": "Reference Library",
                    "out_file": out_file
                })
    except Exception:
        pass
@hooks.on('compile_contexts')
def compile_citation_contexts(manifest, workspace_id=None, **kwargs):
    try:
        from insetu.sdk import ExtensionContext
        from insetu.db import get_connection
        ctx = ExtensionContext('citations', workspace_id)
        paths = ctx.paths

        conn = get_connection("citations", workspace_id=workspace_id)
        cursor = conn.execute("SELECT raw_json, attachments FROM citations ORDER BY id ASC")
        rows = cursor.fetchall()
        if rows:
            def write_citation_bucket(filename, items, list_title):
                out_path = Path(paths["contexts_dir"]).joinpath(filename).as_posix()
                content_lines = []
                content_lines.append("============================================================")
                content_lines.append(f"INSETU TOPOLOGY ({list_title})")
                content_lines.append("============================================================\n")

                for item in items:
                    csl_id = item.get("id", "unknown")
                    title = item.get("title", "Untitled")
                    authors = ", ".join([a.get('family', '') for a in item.get('author', [])])
                    content_lines.append(f"--- [@{csl_id}] ---")
                    content_lines.append(f"Title: {title}")
                    content_lines.append(f"Author(s): {authors}")
                    content_lines.append(f"Type: {item.get('type', 'unknown')}")
                    content_lines.append(f"Raw CSL-JSON: {json.dumps(item)}\n")
                ctx.vfs.save(out_path, "\n".join(content_lines), data={"is_absolute_artifact": True})
                manifest[filename] = {
                    "files": ["data/citations.db"],
                    "meta": {"type": "citation", "title": list_title, "domain": "Reference Library", "desc": f"Academic citations scoped to {list_title}."}
                }

            global_items = []
            bucketed_items = {}

            for row in rows:
                item = json.loads(row['raw_json'])
                atts = json.loads(row['attachments']) if row['attachments'] else []
                global_items.append(item)

                for att in atts:
                    repo = att.get("repo")
                    bucket = att.get("bucket", "None")
                    if repo:
                        if repo not in bucketed_items: bucketed_items[repo] = []
                        if item not in bucketed_items[repo]: bucketed_items[repo].append(item)
                        if bucket and bucket != "None":
                            rb_key = f"{repo}_{bucket}"
                            if rb_key not in bucketed_items: bucketed_items[rb_key] = []
                            if item not in bucketed_items[rb_key]: bucketed_items[rb_key].append(item)

            write_citation_bucket("citations_context.txt", global_items, "GLOBAL REFERENCE LIBRARY")
            for k, items in bucketed_items.items():
                write_citation_bucket(f"{k}_citations_context.txt", items, f"REFERENCE LIBRARY ({k.upper()})")

    except Exception as e:
        print(f"Extension Hook Error (citations compile): {e}")
def get_db(workspace_id=None):
    from insetu.db import get_connection
    return get_connection("citations", workspace_id=workspace_id)
@citations_bp.route('index', methods=['GET'])
def get_metadata_index(ctx):
    """Leverages SQLite JSON1 C-extensions to calculate aggregates instantly, eliminating Python RAM caching."""
    conn = ctx.db
    try:
        pubs = [row[0] for row in conn.execute("SELECT DISTINCT json_extract(raw_json, '$.container-title') FROM citations WHERE json_extract(raw_json, '$.container-title') IS NOT NULL ORDER BY 1").fetchall()]

        authors = set()
        cursor = conn.execute("SELECT json_extract(value, '$.family'), json_extract(value, '$.given') FROM citations, json_each(raw_json, '$.author')")
        for row in cursor.fetchall():
            family, given = row
            if family and given:
                authors.add(f"{family}, {given}")
            elif family:
                authors.add(family)

        return jsonify({"publications": pubs, "authors": sorted(list(authors))})
    except Exception as e:
        return jsonify({"publications": [], "authors": []})
@citations_bp.route('list', methods=['GET'])
def get_citations(ctx):
    try:
        rows = ctx.db.get_all(table="citations", order_by="id ASC")
        items = []
        for row in rows:
            item = json.loads(row['raw_json'])
            item['_attachments'] = json.loads(row['attachments']) if row['attachments'] else []
            items.append(item)
        return jsonify({"citations": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@citations_bp.route('<path:csl_id>/attach', methods=['POST'])
def attach_citation(ctx, csl_id):
    data = ctx.req.json
    attachments = data.get("attachments", [])
    try:
        conn = ctx.db
        conn.execute("UPDATE citations SET attachments = ? WHERE id = ?", (json.dumps(attachments), csl_id))
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
from insetu.workers import update_immediate_job_status, register_callback

def _background_citation_search(job_id, workspace_id, query, source, field, category, page):
    try:
        update_immediate_job_status(job_id, 'processing', "Querying global academic catalogs...", workspace_id=workspace_id)
        import urllib.parse, urllib.request, json
        safe_query = urllib.parse.quote(query) if query else ""
        csl_items = []
        offset = (page - 1) * 20

        if source == 'crossref':
            if field == 'title' and safe_query:
                url = f"https://api.crossref.org/works?query.title={safe_query}&rows=20&offset={offset}"
            elif safe_query:
                url = f"https://api.crossref.org/works?query={safe_query}&rows=20&offset={offset}"
            else:
                update_immediate_job_status(job_id, 'completed', "Search complete.", artifact={"citations": []}, workspace_id=workspace_id)
                return

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
            if not safe_query: 
                update_immediate_job_status(job_id, 'completed', "Search complete.", artifact={"citations": []}, workspace_id=workspace_id)
                return
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

        update_immediate_job_status(job_id, 'completed', "Search complete.", artifact={"citations": csl_items}, workspace_id=workspace_id)
    except Exception as e:
        update_immediate_job_status(job_id, 'failed', f"Catalog Search Failed: {str(e)}", workspace_id=workspace_id)

register_callback("citations", "search_task", _background_citation_search)

@citations_bp.route('search', methods=['POST'])
def search_global_citations(ctx):
    data = ctx.req.json or {}
    query = data.get('q', '').strip()
    source = data.get('source', 'openalex').strip()
    field = data.get('field', 'all').strip()
    category = data.get('category', '').strip()

    try:
        page = int(data.get('page', 1))
    except ValueError:
        page = 1

    if not query and not category:
        return jsonify({"citations": []})

    job_id = ctx.jobs.submit("search_task", query=query, source=source, field=field, category=category, page=page)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

# REMOVE OLD LOGIC
def _dummy_for_patching():
    pass

@citations_bp.route('import', methods=['POST'])
def import_citations(ctx):
    data = ctx.req.json
    if not data:
        return jsonify({"error": "Missing JSON payload"}), 400

    strategy = data.get("strategy", "overwrite") # overwrite, skip, or manual
    items = data.get("citations", []) if isinstance(data, dict) and "citations" in data else data

    if not isinstance(items, list):
        return jsonify({"error": "Invalid format.\nExpecting array of CSL-JSON objects."}), 400
    try:
        conn = ctx.db
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

        return jsonify({
            "status": "success",  
            "imported": count, 
            "conflicts": conflicts,
            "message": f"Successfully integrated {count} records."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@citations_bp.route('<path:csl_id>', methods=['DELETE'])
def delete_citation(ctx, csl_id):
    try:
        conn = ctx.db
        cursor = conn.execute("DELETE FROM citations WHERE id = ?", (csl_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Citation not found"}), 404
        conn.commit()

        return jsonify({"status": "success", "message": f"Deleted citation {csl_id}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@hooks.on('pre_compile_document')
def inject_citation_middleware(text, workspace_id=None, **kwargs):
    """Parses text for citation macros and injects bibliography temp files and citeproc flags into the compiler."""
    import re
    true_ids = list(set(re.findall(r'\[@([^\]]+)\]', text)))
    if not true_ids:
        return None

    csl_items = []
    try:
        conn = get_db(workspace_id)
        placeholders = ','.join(['?'] * len(true_ids))
        cursor = conn.execute(f"SELECT raw_json FROM citations WHERE id IN ({placeholders})", tuple(true_ids))
        for row in cursor.fetchall():
            csl_items.append(json.loads(row['raw_json']))

        if csl_items:
            return {
                "temp_files": { "bibliography.json": json.dumps(csl_items) },
                "compiler_flags": ["--citeproc", "--bibliography=bibliography.json"]
            }
    except Exception:
        pass
    return None