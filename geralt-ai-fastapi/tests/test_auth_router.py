"""
Tests for authentication router URL handling.
"""


def test_callback_redirect_uri_keeps_localhost_http():
    from api.v1.auth.router import _normalize_callback_redirect_uri

    assert (
        _normalize_callback_redirect_uri("http://localhost:8000/api/v1/auth/callback")
        == "http://localhost:8000/api/v1/auth/callback"
    )


def test_callback_redirect_uri_keeps_loopback_ip_http():
    from api.v1.auth.router import _normalize_callback_redirect_uri

    assert (
        _normalize_callback_redirect_uri("http://127.0.0.1:8000/api/v1/auth/callback")
        == "http://127.0.0.1:8000/api/v1/auth/callback"
    )


def test_callback_redirect_uri_upgrades_public_http_to_https():
    from api.v1.auth.router import _normalize_callback_redirect_uri

    assert (
        _normalize_callback_redirect_uri("http://api.example.com/api/v1/auth/callback")
        == "https://api.example.com/api/v1/auth/callback"
    )


def test_callback_redirect_uri_does_not_trust_localhost_substring():
    from api.v1.auth.router import _normalize_callback_redirect_uri

    assert (
        _normalize_callback_redirect_uri("http://localhost.evil.com/api/v1/auth/callback")
        == "https://localhost.evil.com/api/v1/auth/callback"
    )


def test_callback_redirect_uri_keeps_existing_https():
    from api.v1.auth.router import _normalize_callback_redirect_uri

    assert (
        _normalize_callback_redirect_uri("https://api.example.com/api/v1/auth/callback")
        == "https://api.example.com/api/v1/auth/callback"
    )
