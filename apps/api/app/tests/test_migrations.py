import pytest
import os

@pytest.mark.skipif(not os.environ.get("DRISHTI_DATABASE_URL", "").startswith("postgres"), reason="Requires PostgreSQL")
def test_alembic_migrations():
    """Ensure Alembic migrations apply cleanly against PostgreSQL. (P0-2)"""
    import alembic.config
    import alembic.command
    from apps.api.app import config
    
    alembic_cfg = alembic.config.Config("apps/api/alembic.ini")
    alembic_cfg.set_main_option("script_location", "apps/api/migrations")
    alembic_cfg.set_main_option("sqlalchemy.url", config.DATABASE_URL)
    
    # Run the upgrade
    alembic.command.upgrade(alembic_cfg, "head")
    assert True
