"""
DRISTI-NET Extraction Subsystem Public Facade

Provides the authoritative unified entry point for file format validation,
record type detection, coordinate extraction, and structured parsing across
PDF, CSV, JSON, TXT, and forensic archives.
"""

from typing import Tuple
from sqlalchemy.orm import Session
from ..models import Evidence
from .extract_common import (
    validate_upload,
    detect_record_type,
    ExtractionStats,
    ValidationResult,
    ExtractorBase,
    _check_archive,
    norm_phone,
    norm_account,
    norm_name,
    norm_text,
    norm_reg,
    flag_contradictions
)
from .extract_structured import StructuredExtractor
from .extract_document import extract, DocumentExtractor

__all__ = [
    'validate_upload',
    'detect_record_type',
    'ExtractionStats',
    'ValidationResult',
    'ExtractorBase',
    'StructuredExtractor',
    'DocumentExtractor',
    'extract',
    '_check_archive',
    'norm_phone',
    'norm_account',
    'norm_name',
    'norm_text',
    'norm_reg',
    'flag_contradictions'
]
