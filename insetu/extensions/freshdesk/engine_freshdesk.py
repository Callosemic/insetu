import base64
import json
import urllib.request
import urllib.error
from flask import jsonify
from insetu.core.sdk import InSetuExtension
# Declarative schema for settings so users can input credentials via the UI
FRESHDESK_SETTINGS_SCHEMA = [
    {"id": "api_key", "label": "Freshdesk API Key", "type": "password", "secure": True, "default": ""},
    {"id": "domain", "label": "Freshdesk Subdomain", "type": "text", "default": ""}
]
DB_SCHEMA = {
    "freshdesk_ignored": {
        "ticket_id": "INTEGER PRIMARY KEY"
    },
    "freshdesk_tickets": {
        "id": "INTEGER PRIMARY KEY",
        "updated_at": "TEXT",
        "json_data": "TEXT"
    },
    "freshdesk_ledger": {
        "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "start_time": "TEXT",
        "end_time": "TEXT"
    }
}
def _merge_time_intervals(intervals):
    """Merges overlapping timestamp intervals into contiguous blocks."""
    import datetime
    if not intervals: return []
    intervals.sort(key=lambda x: x['start_time'])
    merged = [intervals[0]]

    def _parse_ts(ts):
        try:
            return datetime.datetime.strptime(ts.replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
        except Exception:
            return datetime.datetime.min

    for cur in intervals[1:]:
        last = merged[-1]
        c_start = _parse_ts(cur['start_time'])
        l_end = _parse_ts(last['end_time'])

        # Backwards step heuristic: Allow up to a 7-day gap to seamlessly merge contiguous pagination blocks
        if cur['start_time'] <= last['end_time'] or (c_start - l_end).total_seconds() <= 604800:
            last['end_time'] = max(last['end_time'], cur['end_time'])
        else:
            merged.append(cur)

    return merged
# Instantiate the extension chassis
freshdesk_bp = InSetuExtension(
    'freshdesk', 
    __name__, 
    schema=DB_SCHEMA,
    settings_schema=FRESHDESK_SETTINGS_SCHEMA
)
__depends__ = [] # Extension DAG resolution array
__external_depends__ = ["mistune"] # External PyPI dependencies

def _fd_request(ctx, endpoint, method='GET', payload=None):
    import base64, json, urllib.request, urllib.error
    api_key = ctx.settings.get("api_key")
    domain = ctx.settings.get("domain")

    if not api_key or not domain:
        raise ValueError("Freshdesk credentials are unconfigured.")

    encoded_auth = base64.b64encode(f"{api_key}:X".encode('utf-8')).decode('utf-8')
    headers = {"Authorization": f"Basic {encoded_auth}", "Content-Type": "application/json"}
    url = endpoint if endpoint.startswith("http") else f"https://{domain}.freshdesk.com/api/v2/{endpoint}"

    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            body = response.read().decode('utf-8')
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        raise ValueError(f"Freshdesk API Error: {err_msg}")
@freshdesk_bp.worker("fetch_tickets_task")
def _background_fetch_tickets(ctx, filters=None):
    import time, json
    if filters is None: filters = {}
    page = filters.get("page", 1)
    two_page_spread = filters.get("twoPageSpread", False)

    if two_page_spread:
        ctx.jobs.update_progress(f'Fetching pages {page} and {page+1}...')
    else:
        ctx.jobs.update_progress(f'Fetching page {page}...')

    my_id = None
    try:
        my_id = _fd_request(ctx, "agents/me").get('id')
    except Exception: pass
    agent_map = {}
    try:
        agents_data = _fd_request(ctx, "agents")
        agent_map = {a.get('id'): a.get('contact', {}).get('name', 'Unknown Agent') for a in agents_data}
    except Exception: pass
    # Freshdesk API V2 silently caps the default tickets index to a 30-day trailing window.
    # We must explicitly bypass it by passing a genesis updated_since parameter.
    # URL-encoding the colons ensures the parameter isn't dropped by the network request.
    tickets_data = _fd_request(ctx, f"tickets?include=requester,description&order_by=updated_at&order_type=desc&per_page=100&page={page}&updated_since=2010-01-01T00%3A00%3A00Z")

    if tickets_data and two_page_spread:
        page2_data = _fd_request(ctx, f"tickets?include=requester,description&order_by=updated_at&order_type=desc&per_page=100&page={page+1}&updated_since=2010-01-01T00%3A00%3A00Z")
        if page2_data:
            tickets_data.extend(page2_data)

    if tickets_data:
        times = [t.get("updated_at") for t in tickets_data if t.get("updated_at")]
        if times:
            ctx.db.insert_or_replace("freshdesk_ledger", {
                "start_time": min(times),
                "end_time": max(times)
            })

        for t in tickets_data:
            if t.get('responder_id'):
                t['responder_name'] = agent_map.get(t['responder_id'], f"Agent ID: {t['responder_id']}")
            try:
                ctx.db.insert_or_replace("freshdesk_tickets", {
                    "id": t["id"],
                    "updated_at": t.get("updated_at", ""),
                    "json_data": json.dumps(t)
                })
            except Exception: pass

    try:
        ledger_rows = ctx.db.get_all("freshdesk_ledger")
        intervals = [{"id": r["id"], "start_time": r["start_time"], "end_time": r["end_time"]} for r in ledger_rows]
        merged = _merge_time_intervals(intervals)
        ctx.db.execute("DELETE FROM freshdesk_ledger")
        ctx.db.commit()
        for i, m in enumerate(merged):
            ctx.db.insert_or_replace("freshdesk_ledger", {"id": i+1, "start_time": m["start_time"], "end_time": m["end_time"]})
    except Exception:
        merged = []
    all_db_tickets = []
    try:
        for row in ctx.db.get_all("freshdesk_tickets"):
            all_db_tickets.append(json.loads(row["json_data"]))
    except Exception: pass

    contiguous_count = 0
    if merged:
        latest_block = max(merged, key=lambda x: x['end_time'])
        for t in all_db_tickets:
            t_time = t.get('updated_at', '')
            if latest_block['start_time'] <= t_time <= latest_block['end_time']:
                contiguous_count += 1

    filter_status = filters.get("filterStatus", "Open")
    filter_assignee = filters.get("filterAssignee", "Self + Unassigned")

    filtered_tickets = [
        t for t in all_db_tickets 
        if (filter_status == 'All' or 
            (filter_status == 'Open' and t.get('status') == 2) or 
            (filter_status == 'Pending' and t.get('status') == 3) or 
            (filter_status == 'Open + Pending' and t.get('status') in (2, 3)))
        and (filter_assignee == 'All' or 
            (filter_assignee == 'Self' and t.get('responder_id') == my_id) or 
            (filter_assignee == 'Unassigned' and not t.get('responder_id')) or 
            (filter_assignee == 'Self + Unassigned' and (t.get('responder_id') == my_id or not t.get('responder_id'))))
    ]
    filtered_tickets.sort(key=lambda x: x.get('updated_at', ''), reverse=True)

    return {"message": "Tickets fetched.", "artifact": {"tickets": filtered_tickets, "my_agent_id": my_id, "ledger": merged, "contiguous_count": contiguous_count}}
@freshdesk_bp.worker("fetch_conversations_task")
def _background_fetch_conversations(ctx, ticket_id=None):
    ctx.jobs.update_progress('Fetching conversations...')
    data = _fd_request(ctx, f"tickets/{ticket_id}/conversations")
    return {"message": "Conversations fetched.", "artifact": {"conversations": data}}
@freshdesk_bp.worker("take_ticket_task")
def _background_take_ticket(ctx, ticket_id=None):
    ctx.jobs.update_progress('Assigning ticket...')
    me_data = _fd_request(ctx, "agents/me")
    my_id = me_data.get('id')
    my_name = me_data.get('contact', {}).get('name', 'You')

    updated_ticket = _fd_request(ctx, f"tickets/{ticket_id}", method='PUT', payload={"responder_id": my_id})
    updated_ticket['responder_name'] = my_name

    return {"message": f"Ticket assigned to {my_name}.", "artifact": {"ticket": updated_ticket}}
@freshdesk_bp.worker("post_reply_task")
def _background_post_reply(ctx, ticket_id=None, body=None):
    import re
    ctx.jobs.update_progress('Sending reply...')
    if not body:
        raise ValueError("Reply body is missing.")

    import mistune
    html_body = mistune.html(body)

    _fd_request(ctx, f"tickets/{ticket_id}/reply", method='POST', payload={"body": html_body})

    # Low Memory Footprint Mandate: Re-compile thread data on background thread
    try:
        tkt = _fd_request(ctx, f"tickets/{ticket_id}")
        convs = _fd_request(ctx, f"tickets/{ticket_id}/conversations") or []

        sub = tkt.get("subject", "[No Subject]")
        t_text = f"Ticket ID: #{ticket_id}\nSubject: {sub}\n\n====================\n\n"

        seen = set()
        quote_regex = re.compile(r'\n\s*(?:envoyé\s*:|from\s*:|de\s*:|von\s*:|on\s+.*?(?:wrote|écrit)\s*:|_{10,})', re.I)

        desc = tkt.get("description_text") or tkt.get("description") or ""
        clean_desc = quote_regex.split(desc)[0].trim() if desc else ""
        if clean_desc:
            t_text += f"{clean_desc}\n\n---\n\n"
            seen.add(clean_desc)

        for c in convs:
            if not c.get("private"):
                c_body = c.get("body_text") or c.get("body") or ""
                clean_c = quote_regex.split(c_body)[0].strip() if c_body else ""
                if clean_c and clean_c not in seen:
                    t_text += f"{clean_c}\n\n---\n\n"
                    seen.add(clean_c)

        ctx.vfs.save(f".insetu/freshdesk/{ticket_id}.md", t_text)
    except Exception as backup_err:
        print(f"⚠️ Freshdesk local archival failed: {backup_err}")

    return {"message": "Reply sent.", "artifact": {}}
@freshdesk_bp.worker("resolve_ticket_task")
def _background_resolve_ticket(ctx, ticket_id=None):
    ctx.jobs.update_progress('Marking ticket as resolved...')
    updated_ticket = _fd_request(ctx, f"tickets/{ticket_id}", method='PUT', payload={"status": 4})
    return {"message": "Ticket resolved.", "artifact": {"ticket": updated_ticket}}

@freshdesk_bp.route('tickets/<int:ticket_id>/resolve', methods=['POST'])
def resolve_freshdesk_ticket(ctx, ticket_id):
    job_id = ctx.jobs.submit("resolve_ticket_task", ticket_id=ticket_id)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@freshdesk_bp.route('tickets/<int:ticket_id>/reply', methods=['POST'])
def post_freshdesk_reply(ctx, ticket_id):
    data = ctx.req.json or {}
    body = data.get("body", "")
    job_id = ctx.jobs.submit("post_reply_task", ticket_id=ticket_id, body=body)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@freshdesk_bp.route('tickets/<int:ticket_id>/take', methods=['POST'])
def take_freshdesk_ticket(ctx, ticket_id):
    job_id = ctx.jobs.submit("take_ticket_task", ticket_id=ticket_id)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

@freshdesk_bp.route('tickets/<int:ticket_id>/conversations', methods=['POST'])
def get_freshdesk_conversations(ctx, ticket_id):
    job_id = ctx.jobs.submit("fetch_conversations_task", ticket_id=ticket_id)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
@freshdesk_bp.route('tickets/ignored', methods=['GET'])
def get_ignored_tickets(ctx):
    try:
        rows = ctx.db.get_all("freshdesk_ignored")
        return jsonify([r['ticket_id'] for row in rows])
    except Exception:
        return jsonify([])

@freshdesk_bp.route('tickets/<int:ticket_id>/ignore', methods=['POST'])
def ignore_freshdesk_ticket(ctx, ticket_id):
    ctx.db.insert_or_replace("freshdesk_ignored", {"ticket_id": ticket_id})
    return jsonify({"status": "success"})
@freshdesk_bp.route('tickets/fetch', methods=['POST'])
def get_freshdesk_tickets(ctx):
    """
    Secure proxy endpoint using the asynchronous jobs ledger to prevent event loop starvation.
    """
    data = ctx.req.json or {}
    job_id = ctx.jobs.submit("fetch_tickets_task", coalesce=True, filters=data)
    return jsonify({"status": "accepted", "job_id": job_id}), 202
