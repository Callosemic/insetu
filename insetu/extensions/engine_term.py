from flask import Blueprint

term_bp = Blueprint('term', __name__)
__depends__ = []

# The Terminal extension is currently UI-only (managed by ext_term.js and a standalone ttyd process).
# This empty blueprint scaffold satisfies the dynamic extension loader and reserves the namespace
# for future backend integrations (e.g., auto-booting ttyd natively via Python).