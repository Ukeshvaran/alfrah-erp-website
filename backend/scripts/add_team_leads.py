"""
Add team leads to team_leads (name = login username, access_code = plain code, stored hashed).

Run from repo root:
  cd backend
  python scripts/add_team_leads.py

Requires DATABASE_URL or default Postgres in app.py. Uses same bcrypt hashing as /api/auth/login.
"""
from __future__ import annotations

import os
import sys

# backend/ on path
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)
os.chdir(_BACKEND)

from app import app, bcrypt  # noqa: E402
from models import db, TeamLead  # noqa: E402

# team_name: shown everywhere as the team label (not the login name).
# is_admin: True -> lands on admin dashboard after login.
TEAM_LEADS: list[dict] = [
    {"name": "Dharshini", "access_code": "AC26002", "team_name": "Hustlers", "is_admin": False},
    {"name": "Harini", "access_code": "AC26003", "team_name": "Dragon", "is_admin": False},
    {"name": "Sanjeevi", "access_code": "AC26004", "team_name": "Dominators", "is_admin": False},
    # Example admin (uncomment and set a real access code before running):
    {"name": "admin", "access_code": "admin123", "team_name": "HQ", "is_admin": True},
]


def main() -> None:
    with app.app_context():
        for row in TEAM_LEADS:
            name = str(row["name"]).strip()
            code = str(row["access_code"]).strip()
            team_name = str(row.get("team_name") or name).strip()
            is_admin = bool(row.get("is_admin", False))
            if not name or not code:
                print(f"Skip invalid row: {row}")
                continue
            existing = TeamLead.query.filter_by(name=name).first()
            if existing:
                print(f"Already exists (skipped): {name}")
                continue
            hashed = bcrypt.generate_password_hash(code).decode("utf-8")
            db.session.add(
                TeamLead(
                    name=name,
                    access_code=hashed,
                    team_name=team_name,
                    is_admin=is_admin,
                )
            )
            print(f"Added: {name} (team_name={team_name!r}, is_admin={is_admin})")
        db.session.commit()
        print("Done.")


if __name__ == "__main__":
    main()
