with open('apps/api/app/services/extract.py', 'r') as f:
    lines = f.readlines()

def find_line(prefix):
    for i, line in enumerate(lines):
        if line.startswith(prefix):
            return i
    return -1

idx_class = find_line('class Extractor:')
idx_calls = find_line('    def extract_calls(self, text: str):')
idx_pages = find_line('    def _pages(self, data: bytes, ext: str) -> list[list[str]]:')
idx_extract = find_line('def extract(db: Session, ev: Evidence, data: bytes) -> ExtractionStats:')
idx_flag = find_line('def flag_contradictions(db: Session, case_id: str) -> int:')

common_lines = lines[:idx_class] + [
    "class ExtractorBase:\n"
] + lines[idx_class+1:idx_calls] + lines[idx_flag:]

with open('apps/api/app/services/extract_common.py', 'w') as f:
    f.writelines(common_lines)

with open('apps/api/app/services/extract_structured.py', 'w') as f:
    f.write("import csv, io, json\n")
    f.write("from .extract_common import ExtractorBase, norm_phone, norm_account, norm_name, norm_text, norm_reg\n\n")
    f.write("class StructuredExtractor(ExtractorBase):\n")
    f.writelines(lines[idx_calls:idx_pages])

with open('apps/api/app/services/extract_document.py', 'w') as f:
    f.write("import io, zipfile, re\nfrom pathlib import Path\n")
    f.write("from sqlalchemy.orm import Session\n")
    f.write("from .extract_structured import StructuredExtractor\n")
    f.write("from .extract_common import _check_archive, detect_record_type, ExtractionStats, norm_phone, norm_account, norm_name, norm_text, norm_reg, flag_contradictions\n")
    f.write("from ..models import Evidence\n\n")
    f.write("class DocumentExtractor(StructuredExtractor):\n")
    # need some regex patterns here, wait, regex patterns are defined inside extract_document but actually they were class variables!
    # Wait, where are ORG_SUFFIX_RE etc defined?
    f.writelines(lines[idx_pages:idx_extract])
    f.write("\n\n")
    
    # replace Extractor(db, ev) with DocumentExtractor(db, ev) in extract()
    for line in lines[idx_extract:idx_flag]:
        f.write(line.replace('Extractor(db, ev)', 'DocumentExtractor(db, ev)'))

with open('apps/api/app/services/extract.py', 'w') as f:
    f.write("from .extract_common import validate_upload, detect_record_type, ExtractionStats, ValidationResult\n")
    f.write("from .extract_document import extract\n\n")
    f.write("__all__ = ['validate_upload', 'detect_record_type', 'ExtractionStats', 'ValidationResult', 'extract']\n")
