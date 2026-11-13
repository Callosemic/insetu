from .rules_python import check_python_files
from .rules_javascript import check_javascript_files
from .rules_css import check_css_files
from .rules_python_floor import check_python_version_floor

def run_all():
    check_python_files()
    check_python_version_floor()
    check_javascript_files()
    check_css_files()