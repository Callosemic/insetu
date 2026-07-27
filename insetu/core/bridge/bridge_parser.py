import re

def parse_blocks(text):
    files = {}
    current_file = None
    state = "OUTSIDE"
    current_type = "exact"
    search_lines, replace_lines = [], []

    # Scaffolding: Strip conversational fluff before the first FILE block (INS-TODO-20260709_1032)
    if "<<<<<<< FILE:" in text:
        text = "<<<<<<< FILE:" + text.split("<<<<<<< FILE:", 1)[1]

    # Sanitize invisible non-breaking spaces (NBSP) that break strict matching
    lines = text.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
    for line in lines:
        if line.startswith("<<<<<<< FILE:"):
            current_file = line.replace("<<<<<<< FILE:", "").strip()
            if current_file not in files: files[current_file] = []
            state = "OUTSIDE"
        elif line.startswith("<<<<<<< SEARCH"):
            state = "SEARCH"
            search_lines = []
            # Scaffolding: Support Regex Anchoring (INSETU-QUEUE-20260702_0907_06)
            current_type = "regex" if "REGEX" in line else "exact"
        elif line.startswith("======="):
            if state == "SEARCH":
                state = "REPLACE"
                replace_lines = []
            elif state == "OUTSIDE" and current_file:
                print(f"  [~] Warning: Missing '<<<<<<< SEARCH' tag detected for {current_file}. Auto-healing as a genesis patch.")
                state = "REPLACE"
                search_lines = []
                replace_lines = []
        elif line.startswith(">>>>>>> REPLACE"):
            if state == "REPLACE" and current_file:
                files[current_file].append({
                    "type": current_type,
                    "search": "\n".join(search_lines),
                    "replace": "\n".join(replace_lines)
                })
            state = "OUTSIDE"
        else:
            if state == "SEARCH": search_lines.append(line)
            elif state == "REPLACE": replace_lines.append(line)
    return files