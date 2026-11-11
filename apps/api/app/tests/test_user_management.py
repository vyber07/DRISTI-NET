"""Admin user management: create, update role/jurisdiction, deactivate/reactivate, reset password."""


def test_admin_creates_a_user_and_it_can_log_in(client, admin):
    r = client.post("/api/v1/users", json={"username": "newhire", "display_name": "New Hire",
                                             "role": "REVIEWER", "jurisdiction": "Demo District A", "password": "newhire-demo"},
                     headers=admin)
    assert r.status_code == 201, r.text
    u = r.json()
    assert u["username"] == "newhire" and u["role"] == "REVIEWER" and u["active"] is True
    login = client.post("/api/v1/auth/login", json={"username": "newhire", "password": "newhire-demo"})
    assert login.status_code == 200 and login.json()["user"]["role"] == "REVIEWER"


def test_duplicate_username_rejected(client, admin):
    client.post("/api/v1/users", json={"username": "dup1", "display_name": "Dup", "role": "ANALYST",
                                        "jurisdiction": "", "password": "dup1-demo12"}, headers=admin)
    r = client.post("/api/v1/users", json={"username": "dup1", "display_name": "Dup 2", "role": "ANALYST",
                                            "jurisdiction": "", "password": "dup1-demo34"}, headers=admin)
    assert r.status_code == 409


def test_invalid_role_and_short_password_rejected(client, admin):
    assert client.post("/api/v1/users", json={"username": "bad1", "display_name": "Bad", "role": "SUPERUSER",
                                               "jurisdiction": "", "password": "longenough1"}, headers=admin).status_code == 422
    assert client.post("/api/v1/users", json={"username": "bad2", "display_name": "Bad", "role": "ANALYST",
                                               "jurisdiction": "", "password": "short"}, headers=admin).status_code == 422


def test_non_admin_cannot_create_user(client, investigator, reviewer):
    for headers in (investigator, reviewer):
        r = client.post("/api/v1/users", json={"username": "shouldfail", "display_name": "X", "role": "ANALYST",
                                                 "jurisdiction": "", "password": "shouldfail1"}, headers=headers)
        assert r.status_code == 403


def test_admin_updates_role_and_jurisdiction(client, admin):
    created = client.post("/api/v1/users", json={"username": "promoteme", "display_name": "Promote Me",
                                                   "role": "ANALYST", "jurisdiction": "Demo District A",
                                                   "password": "promoteme1"}, headers=admin).json()
    r = client.patch(f"/api/v1/users/{created['user_id']}", json={"role": "REVIEWER", "jurisdiction": "Demo District B"}, headers=admin)
    assert r.status_code == 200
    u = r.json()
    assert u["role"] == "REVIEWER" and u["jurisdiction"] == "Demo District B" and u["display_name"] == "Promote Me"


def test_update_unknown_user_404_and_non_admin_403(client, admin, investigator):
    assert client.patch("/api/v1/users/USR-doesnotexist", json={"role": "ANALYST"}, headers=admin).status_code == 404
    created = client.post("/api/v1/users", json={"username": "lockedtarget", "display_name": "Locked Target",
                                                   "role": "ANALYST", "jurisdiction": "", "password": "lockedtarget1"}, headers=admin).json()
    assert client.patch(f"/api/v1/users/{created['user_id']}", json={"role": "ADMIN"}, headers=investigator).status_code == 403


def test_deactivate_blocks_login_and_reactivate_restores_it(client, admin):
    created = client.post("/api/v1/users", json={"username": "revokeme", "display_name": "Revoke Me",
                                                   "role": "ANALYST", "jurisdiction": "", "password": "revokeme1"}, headers=admin).json()
    assert client.post(f"/api/v1/users/{created['user_id']}/deactivate", headers=admin).json()["active"] is False
    assert client.post("/api/v1/auth/login", json={"username": "revokeme", "password": "revokeme1"}).status_code == 401

    r = client.post(f"/api/v1/users/{created['user_id']}/reactivate", headers=admin)
    assert r.status_code == 200 and r.json()["active"] is True
    assert client.post("/api/v1/auth/login", json={"username": "revokeme", "password": "revokeme1"}).status_code == 200


def test_admin_cannot_deactivate_self(client, admin):
    me = client.get("/api/v1/auth/me", headers=admin).json()
    assert client.post(f"/api/v1/users/{me['user_id']}/deactivate", headers=admin).status_code == 400


def test_non_admin_cannot_deactivate(client, admin, reviewer):
    created = client.post("/api/v1/users", json={"username": "protectme", "display_name": "Protect Me",
                                                   "role": "ANALYST", "jurisdiction": "", "password": "protectme1"}, headers=admin).json()
    assert client.post(f"/api/v1/users/{created['user_id']}/deactivate", headers=reviewer).status_code == 403


def test_admin_resets_password(client, admin):
    created = client.post("/api/v1/users", json={"username": "forgotpw", "display_name": "Forgot PW",
                                                   "role": "ANALYST", "jurisdiction": "", "password": "oldpassword1"}, headers=admin).json()
    r = client.post(f"/api/v1/users/{created['user_id']}/reset-password", json={"new_password": "newpassword1"}, headers=admin)
    assert r.status_code == 200
    assert client.post("/api/v1/auth/login", json={"username": "forgotpw", "password": "oldpassword1"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"username": "forgotpw", "password": "newpassword1"}).status_code == 200


def test_password_reset_invalidates_tokens_issued_before_it(client, admin):
    """SEC-02: a reset must take effect immediately, not just at the old token's natural expiry."""
    created = client.post("/api/v1/users", json={"username": "revoketest", "display_name": "Revoke Test",
                                                   "role": "ANALYST", "jurisdiction": "", "password": "beforereset1"}, headers=admin).json()
    old_token = client.post("/api/v1/auth/login", json={"username": "revoketest", "password": "beforereset1"}).json()["token"]
    old_headers = {"Authorization": f"Bearer {old_token}"}
    assert client.get("/api/v1/auth/me", headers=old_headers).status_code == 200

    client.post(f"/api/v1/users/{created['user_id']}/reset-password", json={"new_password": "afterreset1"}, headers=admin)

    # The pre-reset token must now be refused, even though it hasn't naturally expired.
    assert client.get("/api/v1/auth/me", headers=old_headers).status_code == 401
    # A freshly issued token (new password) works normally.
    new_token = client.post("/api/v1/auth/login", json={"username": "revoketest", "password": "afterreset1"}).json()["token"]
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"}).status_code == 200
