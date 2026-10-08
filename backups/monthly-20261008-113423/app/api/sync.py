"""Validate and atomically replace a brand's current source snapshot."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import current_brand
from app.models.schemas import (
    Brand, Campaign, Inventory, InventoryUpdate, IngestionSnapshot, LatestSnapshotResponse, SyncPayload, SyncResponse,
)
from app.services.analytics import normalize_campaigns, normalize_inventory

router = APIRouter()


@router.patch("/inventory", response_model=SyncResponse)
def update_inventory(request: InventoryUpdate, db: Session = Depends(get_db),
                     brand: Brand = Depends(current_brand)) -> SyncResponse:
    """Save actual SKU totals without replacing ads, sales, tokens or history."""
    connection = db.connection()
    if connection.dialect.name == "sqlite":
        raw = connection.connection.driver_connection
        if not raw.in_transaction:
            connection.exec_driver_sql("BEGIN IMMEDIATE")
    db.execute(select(Brand.id).where(Brand.id == brand.id).with_for_update())
    previous = db.scalar(select(IngestionSnapshot).where(IngestionSnapshot.brand_id == brand.id)
                         .order_by(IngestionSnapshot.id.desc()).limit(1))
    if previous is None or previous.id != request.snapshot_id:
        raise HTTPException(409, "Source data changed. Refresh before updating inventory.")
    payload = SyncPayload.model_validate(previous.payload)
    advertised = {record.sku for record in payload.meta + payload.google}
    changed = {record.sku for record in request.erp}
    if changed - advertised:
        raise HTTPException(422, "Inventory SKU names must match advertised products exactly: "
                            + ", ".join(sorted(changed - advertised)))
    margins = {row["sku"]: row["margin"] for row in normalize_campaigns(payload)}
    if any(row.margin is not None and row.margin != margins[row.sku] for row in request.erp):
        raise HTTPException(422, "Inventory-only updates cannot change contribution margins. Use a full snapshot import.")
    # A submitted record is the total across warehouses; preserve all other SKUs.
    updated = payload.model_dump(mode="json")
    updated["erp"] = [row.model_dump(mode="json") for row in payload.erp if row.sku not in changed]
    updated["erp"].extend({**row.model_dump(mode="json"), "margin": margins[row.sku]}
                         for row in request.erp)
    if len(updated["erp"]) > 5000:
        raise HTTPException(422, "At most 5000 ERP records are supported per snapshot")
    payload = SyncPayload.model_validate(updated)
    campaigns = normalize_campaigns(payload)
    snapshot = IngestionSnapshot(brand_id=brand.id, payload=payload.model_dump(mode="json"))
    db.add(snapshot)
    db.execute(delete(Inventory).where(Inventory.brand_id == brand.id, Inventory.sku.in_(changed)))
    for row in normalize_inventory(payload):
        if row["sku"] in changed:
            db.add(Inventory(brand_id=brand.id, **row))
    db.commit()
    db.refresh(snapshot)
    return SyncResponse(status="synced", snapshot_id=snapshot.id, data_mode=payload.data_mode,
                        source_counts={"meta": len(payload.meta), "google": len(payload.google),
                                       "shopify": len(payload.shopify), "erp": len(payload.erp)},
                        campaigns=campaigns, budget=payload.budget)


@router.post("", response_model=SyncResponse)
def sync_sources(payload: SyncPayload, db: Session = Depends(get_db),
                 brand: Brand = Depends(current_brand)) -> SyncResponse:
    campaigns = normalize_campaigns(payload)
    inventories = normalize_inventory(payload)
    # Lock the brand so concurrent snapshots cannot mix normalized rows.
    db.execute(select(Brand).where(Brand.id == brand.id).with_for_update())
    snapshot = IngestionSnapshot(brand_id=brand.id, payload=payload.model_dump(mode="json"))
    db.add(snapshot)
    db.execute(delete(Campaign).where(Campaign.brand_id == brand.id))
    db.execute(delete(Inventory).where(Inventory.brand_id == brand.id))
    for row in campaigns:
        db.add(Campaign(brand_id=brand.id, sku=row["sku"], platform=row["channel"],
                        daily_spend=row["spend"], generated_revenue=row["revenue"]))
    for row in inventories:
        db.add(Inventory(brand_id=brand.id, **row))
    db.commit()
    db.refresh(snapshot)
    return SyncResponse(status="synced", snapshot_id=snapshot.id, data_mode=payload.data_mode,
                        source_counts={"meta": len(payload.meta), "google": len(payload.google),
                                       "shopify": len(payload.shopify), "erp": len(payload.erp)},
                        campaigns=campaigns, budget=payload.budget)


@router.get("/latest", response_model=LatestSnapshotResponse)
def latest_snapshot(db: Session = Depends(get_db), brand: Brand = Depends(current_brand)) -> LatestSnapshotResponse:
    connection = db.connection()
    if connection.dialect.name == "sqlite":
        # sqlite3 legacy mode does not BEGIN for SELECT. Explicitly start a
        # read transaction so all three SELECTs see the same database snapshot.
        raw = connection.connection.driver_connection
        if not raw.in_transaction:
            connection.exec_driver_sql("BEGIN")
    # Share the ingestion lock so metadata and current relational rows describe
    # the same committed snapshot on PostgreSQL.
    db.execute(select(Brand.id).where(Brand.id == brand.id).with_for_update(read=True))
    snapshot = db.scalar(select(IngestionSnapshot).where(IngestionSnapshot.brand_id == brand.id)
                         .order_by(IngestionSnapshot.id.desc()).limit(1))
    if snapshot is None:
        raise HTTPException(404, "No data synced for this brand")
    payload = SyncPayload.model_validate(snapshot.payload)
    observed = {(row["sku"], row["channel"]): row for row in normalize_campaigns(payload)}
    records = db.execute(select(Campaign, Inventory).outerjoin(
        Inventory, and_(Inventory.brand_id == Campaign.brand_id, Inventory.sku == Campaign.sku)
    ).where(Campaign.brand_id == brand.id).order_by(Campaign.sku, Campaign.platform)).all()
    campaigns = [{"sku": campaign.sku, "channel": campaign.platform,
                  "spend": campaign.daily_spend, "revenue": campaign.generated_revenue,
                  "margin": stock.contribution_margin if stock else observed.get(
                      (campaign.sku, campaign.platform), {}).get("margin", 0.0),
                  "inventory_data_missing": stock is None,
                  "stock_units": stock.current_stock_units if stock else 0.0,
                  "daily_velocity": stock.daily_stock_velocity if stock else 0.0}
                 for campaign, stock in records]
    return LatestSnapshotResponse(snapshot_id=snapshot.id, created_at=snapshot.created_at,
                                  data_mode=payload.data_mode, budget=payload.budget,
                                  source_counts={"meta": len(payload.meta), "google": len(payload.google),
                                                 "shopify": len(payload.shopify), "erp": len(payload.erp)},
                                  campaigns=campaigns)

