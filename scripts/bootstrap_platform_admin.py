"""Provision the first platform operator only. Requires psycopg[binary] and bcrypt.

Uses the backend's private environment file; never accepts passwords in process arguments.
Does not change tenant staff accounts or reset an existing platform account.
"""
import argparse
from pathlib import Path
import re
import secrets
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit


def provision(env_file: Path, credentials_file: Path):
    import bcrypt
    import psycopg
    from psycopg import sql

    values = {}
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip("\"'")
    username = values.get("SENTINEL_PLATFORM_ADMIN_USERNAME", "admin")
    password = values.get("SENTINEL_PLATFORM_ADMIN_PASSWORD") or secrets.token_urlsafe(24)
    if not re.fullmatch(r"[A-Za-z0-9._@-]{3,64}", username):
        raise ValueError("Invalid platform admin username")
    if len(password) < 14 or len(password.encode()) > 72:
        raise ValueError("Platform password must be at least 14 characters and at most 72 UTF-8 bytes")
    credentials_file = credentials_file.resolve()
    repository = Path(__file__).resolve().parents[1]
    if credentials_file.is_relative_to(repository):
        raise ValueError("Keep the private credentials file outside the Sentinel repository")
    if credentials_file.exists():
        raise ValueError("Choose a new credentials file; existing private files are never overwritten")
    parts = urlsplit(values["SPRING_DATASOURCE_URL"].removeprefix("jdbc:"))
    query = [("channel_binding" if key == "channelBinding" else key, value)
             for key, value in parse_qsl(parts.query) if key in ("sslmode", "channel_binding", "channelBinding")]
    connection_url = urlunsplit(parts._replace(query=urlencode(query)))
    schema = values.get("SPRING_JPA_PROPERTIES_HIBERNATE_DEFAULT_SCHEMA", "sentinel")
    with psycopg.connect(connection_url, user=values["SPRING_DATASOURCE_USERNAME"],
                         password=values["SPRING_DATASOURCE_PASSWORD"], connect_timeout=15) as connection:
        with connection.cursor() as cursor:
            cursor.execute("select pg_advisory_xact_lock(78356118)")
            cursor.execute(sql.SQL("select count(*) from {}.platform_accounts").format(sql.Identifier(schema)))
            if cursor.fetchone()[0]:
                print("A platform operator already exists. No credentials were changed.")
                return
            encoded = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
            cursor.execute(sql.SQL("insert into {}.platform_accounts(username,password_hash,enabled,session_version,created_at) "
                                   "values (%s,%s,true,0,current_timestamp)").format(sql.Identifier(schema)), (username, encoded))
            cursor.execute(sql.SQL("insert into {}.platform_audit_events(actor,action,detail,created_at) "
                                   "values ('bootstrap','PLATFORM_ACCOUNT_CREATED','Initial platform operator provisioned',current_timestamp)")
                           .format(sql.Identifier(schema)))
            credentials_file.parent.mkdir(parents=True, exist_ok=True)
            with credentials_file.open("x", encoding="utf-8") as private_file:
                private_file.write(
                "Sentinel platform administrator\n"
                "URL: https://sentinel.mamadoubah.tech/platform/login\n"
                f"Username: {username}\nPassword: {password}\n"
                "Tenant code: none (platform account)\nRole: PLATFORM_ADMIN\n\n"
                "This is separate from Sutura and all tenant staff logins.\n")
    print(f"Platform operator provisioned. Private login details: {credentials_file}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, default=Path("backend/.env"))
    parser.add_argument("--credentials-file", type=Path, required=True)
    arguments = parser.parse_args()
    try:
        provision(arguments.env, arguments.credentials_file)
    except Exception as error:
        # Driver exceptions can contain connection secrets: print only the class.
        raise SystemExit(f"Provisioning did not complete ({type(error).__name__}). Check migration availability and private configuration.")
