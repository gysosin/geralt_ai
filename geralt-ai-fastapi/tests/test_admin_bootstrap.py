"""Admin bootstrap script tests."""
import logging
from unittest.mock import MagicMock

import pytest

from scripts.create_admin_user import create_admin


def test_create_admin_requires_explicit_password(monkeypatch):
    monkeypatch.delenv("GERALT_ADMIN_PASSWORD", raising=False)

    with pytest.raises(ValueError, match="GERALT_ADMIN_PASSWORD"):
        create_admin(users_db=MagicMock())


def test_create_admin_hashes_password_without_logging_plaintext(monkeypatch, caplog):
    password = "secure-admin-password"
    users_db = MagicMock()
    users_db.find_one.return_value = None
    monkeypatch.setenv("GERALT_ADMIN_PASSWORD", password)

    with caplog.at_level(logging.INFO):
        create_admin(users_db=users_db)

    inserted = users_db.insert_one.call_args.args[0]
    assert inserted["password"] != password
    assert password not in caplog.text
    assert inserted["email"] == "admin@geraltai.com"
    assert inserted["role"] == "admin"
