from insetu.kernel.extension import InSetuExtension

EDITOR_SCHEMA = [
    {
        "id": "insetu_md_links",
        "label": "Enable Interactive MD Links",
        "type": "boolean",
        "scope": "daemon",
        "default": True,
        "description": "Renders Markdown links as clickable icons in the editor."
    }
]

editor_bp = InSetuExtension(
    'editor', 
    __name__,
    title="Editor Preferences",
    description="Global code and text editor preferences.",
    settings_schema=EDITOR_SCHEMA,
    core=True
)
__depends__ = []