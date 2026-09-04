from insetu.core.sdk import InSetuExtension

offline_bp = InSetuExtension(
    'offline',
    __name__,
    title="Offline Engine",
    description="Core Tier 0 offline caching and IndexedDB synchronization."
)

__depends__ = []