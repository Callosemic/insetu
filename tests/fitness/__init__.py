from .rules_python import check_python_files
from .rules_javascript import check_javascript_files
from .rules_css import check_css_files

def run_all():
    check_python_files()
    check_javascript_files()
    check_css_files()