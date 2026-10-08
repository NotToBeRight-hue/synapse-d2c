"""Operator-only token provisioning, revocation, and legacy snapshot assignment."""
import argparse
import secrets
from sqlalchemy import delete, select
from app.core.database import SessionLocal, initialize_database
from app.core.security import hash_token
from app.models.schemas import ApiToken, Brand, IngestionSnapshot


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create-brand")
    create.add_argument("--name", required=True)
    rotate = commands.add_parser("rotate-token")
    rotate.add_argument("--brand-id", type=int, required=True)
    assign = commands.add_parser("assign-snapshot")
    assign.add_argument("--brand-id", type=int, required=True)
    assign.add_argument("--snapshot-id", type=int, required=True)
    args = parser.parse_args()
    initialize_database()
    with SessionLocal() as db:
        if args.command == "create-brand":
            name = args.name.strip()
            if not name or len(name) > 100:
                parser.error("Brand name must contain 1 to 100 characters")
            if db.scalar(select(Brand).where(Brand.name == name)):
                parser.error("Brand already exists; use rotate-token to replace its token")
            brand = Brand(name=name)
            db.add(brand)
            db.flush()
        else:
            brand = db.get(Brand, args.brand_id)
            if brand is None:
                parser.error("Brand does not exist")
        if args.command == "assign-snapshot":
            snapshot = db.get(IngestionSnapshot, args.snapshot_id)
            if snapshot is None or snapshot.brand_id is not None:
                parser.error("Only existing unassigned legacy snapshots can be assigned")
            snapshot.brand_id = brand.id
            db.commit()
            print("Legacy snapshot assigned. Re-sync to populate normalized current tables.")
            return
        token = secrets.token_urlsafe(32)
        if args.command == "rotate-token":
            db.execute(delete(ApiToken).where(ApiToken.brand_id == brand.id))
        db.add(ApiToken(brand_id=brand.id, token_hash=hash_token(token)))
        db.commit()
        print(f"Brand ID: {brand.id}\nAPI token (shown once): {token}")


if __name__ == "__main__":
    main()

