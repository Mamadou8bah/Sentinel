from datetime import datetime, timezone
import json
from pathlib import Path
import secrets
import sqlite3
import time


class ChallengeError(ValueError):
    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(message)


class ChallengeStore:
    """SQLite serializes consumes across workers and survives service restarts."""
    def __init__(self, path: str):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.execute("CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, expires REAL NOT NULL, consumed INTEGER NOT NULL DEFAULT 0, result TEXT)")

            columns = {row[1] for row in db.execute("PRAGMA table_info(challenges)")}
            if "instructions" not in columns:
                db.execute("ALTER TABLE challenges ADD COLUMN instructions TEXT")

    def instructions(self, identifier):
        with self.connection() as db:
            row = db.execute("SELECT expires,instructions FROM challenges WHERE id=?", (identifier,)).fetchone()
        if row is None: raise ChallengeError(404, "Unknown liveness challenge")
        if row[0] < time.time(): raise ChallengeError(410, "Liveness challenge expired")
        if row[1] is None: raise ChallengeError(409, "Legacy challenge must be restarted")
        return json.loads(row[1])

    def connection(self):
        return sqlite3.connect(self.path, timeout=10)

    def create(self) -> dict:
        identifier = secrets.token_urlsafe(32)
        expires = time.time() + 1800
        instructions = secrets.choice([["LOOK_FORWARD", "TURN_LEFT", "TURN_RIGHT"], ["LOOK_FORWARD", "TURN_RIGHT", "TURN_LEFT"]])
        with self.connection() as db:
            db.execute("DELETE FROM challenges WHERE expires < ?", (time.time() - 3600,))
            db.execute("INSERT INTO challenges(id,expires,instructions) VALUES (?,?,?)", (identifier, expires, json.dumps(instructions)))
        return {"challengeId": identifier, "instructions": instructions,
                "expiresAt": datetime.fromtimestamp(expires, timezone.utc).isoformat()}

    def consume(self, identifier: str, result: dict):
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT expires,consumed FROM challenges WHERE id=?", (identifier,)).fetchone()
            if not row:
                raise ChallengeError(404, "Unknown liveness challenge")
            if row[0] < time.time():
                raise ChallengeError(410, "Liveness challenge expired")
            if row[1]:
                raise ChallengeError(409, "Liveness challenge already consumed")
            db.execute("UPDATE challenges SET consumed=1,result=? WHERE id=?", (json.dumps(result), identifier))

    def result(self, identifier: str) -> dict | None:
        with self.connection() as db:
            row = db.execute("SELECT expires,result FROM challenges WHERE id=?", (identifier,)).fetchone()
            if not row or row[0] < time.time() or row[1] is None:
                return None
            return json.loads(row[1])
