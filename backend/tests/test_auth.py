"""Tests for core/auth.py"""
import sys
from unittest.mock import MagicMock, patch

# ── Block external deps before import ─────────────────────────────────────────
_mock_supabase = MagicMock()
_mock_settings = MagicMock()
_mock_settings.SUPABASE_JWT_SECRET = "test-secret"
_mock_settings.SUPABASE_URL        = "https://test.supabase.co"

# jose must be mocked before core.auth is imported
_JWTError = type("JWTError", (Exception,), {})
_mock_jwt = MagicMock()
_mock_jose = MagicMock(jwt=_mock_jwt, JWTError=_JWTError)

sys.modules["jose"]      = _mock_jose
sys.modules["jose.jwt"]  = _mock_jwt
sys.modules["httpx"]     = MagicMock()
sys.modules["db"]        = MagicMock()
sys.modules["db.client"] = MagicMock(supabase=_mock_supabase)
sys.modules["config"]    = MagicMock(settings=_mock_settings)
# Do NOT mock "core" — leave the real package so other test files can import
# from core.quota, core.security, etc. without hitting a MagicMock stub.

import pytest
from fastapi import HTTPException
from core.auth import get_current_user, require_admin, require_owner_or_admin


class TestGetCurrentUser:
    def setup_method(self):
        _mock_jwt.reset_mock()

    def test_raises_401_on_missing_header(self):
        with pytest.raises(HTTPException) as exc:
            get_current_user(authorization=None)
        assert exc.value.status_code == 401

    def test_raises_401_when_not_bearer(self):
        with pytest.raises(HTTPException) as exc:
            get_current_user(authorization="Basic abc123")
        assert exc.value.status_code == 401

    def test_raises_401_on_jwt_error(self):
        _mock_jwt.get_unverified_header.side_effect = _JWTError("bad token")
        with pytest.raises(HTTPException) as exc:
            get_current_user(authorization="Bearer bad.token.here")
        assert exc.value.status_code == 401

    def test_returns_user_dict_on_valid_hs256_token(self):
        _mock_jwt.get_unverified_header.side_effect = None
        _mock_jwt.get_unverified_header.return_value = {"alg": "HS256"}
        _mock_jwt.decode.return_value = {"sub": "user-uuid", "email": "test@example.com"}

        result = get_current_user(authorization="Bearer valid.token.here")
        assert result["id"] == "user-uuid"
        assert result["email"] == "test@example.com"

    def test_raises_401_when_sub_missing(self):
        _mock_jwt.get_unverified_header.side_effect = None
        _mock_jwt.get_unverified_header.return_value = {"alg": "HS256"}
        _mock_jwt.decode.return_value = {"email": "test@example.com"}  # no 'sub'

        with pytest.raises(HTTPException) as exc:
            get_current_user(authorization="Bearer some.token")
        assert exc.value.status_code == 401
        assert "sub" in exc.value.detail

    def test_raw_payload_included_in_return(self):
        _mock_jwt.get_unverified_header.return_value = {"alg": "HS256"}
        payload = {"sub": "u-1", "email": "x@y.com", "role": "owner"}
        _mock_jwt.decode.return_value = payload

        result = get_current_user(authorization="Bearer tok")
        assert result["raw"] == payload


class TestRequireAdmin:
    def setup_method(self):
        _mock_supabase.reset_mock()

    def _stub_profile(self, role):
        (
            _mock_supabase.table.return_value
            .select.return_value
            .eq.return_value
            .single.return_value
            .execute.return_value.data
        ) = ({"role": role} if role is not None else None)

    def test_raises_403_when_profile_not_found(self):
        self._stub_profile(None)
        with pytest.raises(HTTPException) as exc:
            require_admin(user={"id": "u-1", "email": "a@b.com"})
        assert exc.value.status_code == 403

    def test_raises_403_when_role_not_admin(self):
        self._stub_profile("owner")
        with pytest.raises(HTTPException) as exc:
            require_admin(user={"id": "u-1", "email": "a@b.com"})
        assert exc.value.status_code == 403

    def test_returns_user_when_admin(self):
        self._stub_profile("admin")
        user   = {"id": "u-1", "email": "admin@test.com"}
        result = require_admin(user=user)
        assert result == user


class TestRequireOwnerOrAdmin:
    _USER  = {"id": "user-abc", "email": "user@test.com"}
    _BIZ   = "biz-999"

    def setup_method(self):
        _mock_supabase.reset_mock()

    def _stub_table_responses(self, biz_data, profile_data=None):
        """Route table('businesses') and table('profiles') to separate mock data."""
        def table_effect(name):
            m = MagicMock()
            data = biz_data if name == "businesses" else profile_data
            (
                m.select.return_value
                 .eq.return_value
                 .single.return_value
                 .execute.return_value.data
            ) = data
            return m
        _mock_supabase.table.side_effect = table_effect

    def test_raises_404_when_business_not_found(self):
        self._stub_table_responses(biz_data=None)
        with pytest.raises(HTTPException) as exc:
            require_owner_or_admin(business_id=self._BIZ, user=self._USER)
        assert exc.value.status_code == 404

    def test_returns_user_when_user_is_owner(self):
        self._stub_table_responses(biz_data={"owner_id": self._USER["id"]})
        result = require_owner_or_admin(business_id=self._BIZ, user=self._USER)
        assert result == self._USER

    def test_returns_user_when_user_is_admin(self):
        self._stub_table_responses(
            biz_data={"owner_id": "different-owner"},
            profile_data={"role": "admin"},
        )
        result = require_owner_or_admin(business_id=self._BIZ, user=self._USER)
        assert result == self._USER

    def test_raises_403_when_neither_owner_nor_admin(self):
        self._stub_table_responses(
            biz_data={"owner_id": "different-owner"},
            profile_data={"role": "owner"},
        )
        with pytest.raises(HTTPException) as exc:
            require_owner_or_admin(business_id=self._BIZ, user=self._USER)
        assert exc.value.status_code == 403

    def test_raises_403_when_profile_missing(self):
        self._stub_table_responses(
            biz_data={"owner_id": "different-owner"},
            profile_data=None,
        )
        with pytest.raises(HTTPException) as exc:
            require_owner_or_admin(business_id=self._BIZ, user=self._USER)
        assert exc.value.status_code == 403
