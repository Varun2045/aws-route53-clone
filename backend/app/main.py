import hashlib
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Header, Cookie, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, crud, auth, import_export
from .database import engine, get_db, Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AWS Route53 Clone API")

# Setup CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event to seed default admin user
@app.on_event("startup")
def seed_admin_user():
    db = next(get_db())
    try:
        admin_user = crud.get_user_by_username(db, "admin")
        if not admin_user:
            # Seed a default user
            crud.create_user(
                db=db,
                user=schemas.UserCreate(username="admin", password="admin"),
                aws_account_id="1234-5678-9012"
            )
            print("Default admin user seeded successfully (admin/admin).")
    finally:
        db.close()


# --- AUTHENTICATION ENDPOINTS ---

@app.post("/api/auth/login")
def login(user_in: schemas.UserLogin, response: Response, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_username(db, user_in.username)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # Hash check
    hashed_pwd = hashlib.sha256(user_in.password.encode()).hexdigest()
    if db_user.password_hash != hashed_pwd:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    # Generate token
    token = auth.create_session_token(db_user.username)
    
    # Set secure cookie
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in production with HTTPS
        max_age=86400  # 1 day
    )
    
    return {"token": token, "user": schemas.UserResponse.model_validate(db_user)}

@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("session")
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


# --- HOSTED ZONES ENDPOINTS ---

@app.get("/api/hosted-zones", response_model=List[schemas.HostedZoneResponse])
def list_hosted_zones(
    query: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_hosted_zones(db, query=query, skip=skip, limit=limit)

@app.post("/api/hosted-zones", response_model=schemas.HostedZoneResponse, status_code=status.HTTP_201_CREATED)
def create_hosted_zone(
    zone_in: schemas.HostedZoneCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Check if a zone with this name already exists
    # Route53 allows duplicate zone names, but for user safety let's just log it or allow it.
    # In Route53 you can create multiple zones with same domain name (they get different IDs), so we allow it.
    return crud.create_hosted_zone(db, zone_in)

@app.get("/api/hosted-zones/{zone_id}", response_model=schemas.HostedZoneDetailResponse)
def get_hosted_zone_detail(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_zone = crud.get_hosted_zone(db, zone_id)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
    return db_zone

@app.put("/api/hosted-zones/{zone_id}", response_model=schemas.HostedZoneResponse)
def update_hosted_zone(
    zone_id: str,
    zone_in: schemas.HostedZoneUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_zone = crud.update_hosted_zone(db, zone_id, zone_in)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
    return db_zone

@app.delete("/api/hosted-zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hosted_zone(
    zone_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    success = crud.delete_hosted_zone(db, zone_id)
    if not success:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- DNS RECORDS ENDPOINTS ---

@app.get("/api/hosted-zones/{zone_id}/records", response_model=List[schemas.DNSRecordResponse])
def list_dns_records(
    zone_id: str,
    query: Optional[str] = None,
    type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify zone exists
    db_zone = crud.get_hosted_zone(db, zone_id)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
    return crud.get_dns_records_by_zone(db, zone_id, query=query, record_type=type, skip=skip, limit=limit)

@app.post("/api/hosted-zones/{zone_id}/records", response_model=schemas.DNSRecordResponse, status_code=status.HTTP_201_CREATED)
def create_dns_record(
    zone_id: str,
    record_in: schemas.DNSRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Check if duplicate record exists (same name and type and set_id in same zone)
    # Route53 doesn't allow duplicate names and types unless routing policy is not Simple
    normalized_name = crud.normalize_dns_name(record_in.name)
    db_zone = crud.get_hosted_zone(db, zone_id)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
    
    if normalized_name == ".":
        normalized_name = db_zone.name
    elif not normalized_name.endswith(db_zone.name):
        normalized_name = f"{normalized_name.rstrip('.')}.{db_zone.name}"

    existing_records = db.query(models.DNSRecord).filter(
        models.DNSRecord.hosted_zone_id == zone_id,
        models.DNSRecord.name == normalized_name,
        models.DNSRecord.type == record_in.type
    ).all()

    if existing_records and record_in.routing_policy == "Simple":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A record with the name '{normalized_name}' and type '{record_in.type}' already exists in this Hosted Zone. Dual records of the same type are only allowed with weighted or multi-value routing policies."
        )

    db_record = crud.create_dns_record(db, zone_id, record_in)
    if not db_record:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
    return db_record

@app.put("/api/hosted-zones/{zone_id}/records/{record_id}", response_model=schemas.DNSRecordResponse)
def update_dns_record(
    zone_id: str,
    record_id: str,
    record_in: schemas.DNSRecordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify zone exists
    db_zone = crud.get_hosted_zone(db, zone_id)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
        
    db_record = crud.update_dns_record(db, record_id, record_in)
    if not db_record:
        raise HTTPException(status_code=404, detail="DNS Record not found")
    return db_record

@app.delete("/api/hosted-zones/{zone_id}/records/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dns_record(
    zone_id: str,
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Verify zone exists
    db_zone = crud.get_hosted_zone(db, zone_id)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
        
    # Prevent deleting default SOA and NS records that are critical
    db_record = crud.get_dns_record(db, record_id)
    if db_record and db_record.name == db_zone.name and db_record.type in ["SOA", "NS"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Default SOA and NS records at the apex domain cannot be deleted."
        )

    success = crud.delete_dns_record(db, record_id)
    if not success:
        raise HTTPException(status_code=404, detail="DNS Record not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/api/hosted-zones/{zone_id}/records/bulk-delete")
def bulk_delete(
    zone_id: str,
    record_ids: List[str],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_zone = crud.get_hosted_zone(db, zone_id)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
        
    # Filter out apex NS/SOA from deletion lists
    valid_ids_to_delete = []
    for r_id in record_ids:
        r = crud.get_dns_record(db, r_id)
        if r and not (r.name == db_zone.name and r.type in ["SOA", "NS"]):
            valid_ids_to_delete.append(r_id)
            
    deleted_count = crud.bulk_delete_records(db, valid_ids_to_delete)
    return {"deleted_count": deleted_count}


# --- IMPORT / EXPORT ENDPOINTS ---

@app.post("/api/hosted-zones/{zone_id}/import/bind")
def import_bind(
    zone_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_zone = crud.get_hosted_zone(db, zone_id)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
        
    try:
        file_content = file.file.read().decode("utf-8")
        parsed_records = import_export.parse_bind_zone(file_content, db_zone.name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid BIND file structure: {str(e)}"
        )
        
    imported_count = 0
    for record in parsed_records:
        try:
            crud.create_dns_record(db, zone_id, record)
            imported_count += 1
        except Exception:
            # Skip duplicates or invalid records in BIND file
            continue
            
    return {"imported_count": imported_count}

@app.get("/api/hosted-zones/{zone_id}/export")
def export_zone(
    zone_id: str,
    format: str = "bind",  # "bind" or "json"
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    db_zone = crud.get_hosted_zone(db, zone_id)
    if not db_zone:
        raise HTTPException(status_code=404, detail="Hosted Zone not found")
        
    records = db.query(models.DNSRecord).filter(models.DNSRecord.hosted_zone_id == zone_id).all()
    
    if format == "json":
        # Return serialized records
        return [schemas.DNSRecordResponse.model_validate(r) for r in records]
        
    # Return raw text BIND file
    bind_text = import_export.export_to_bind(db_zone.name, records)
    return Response(
        content=bind_text,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={db_zone.name}zone"}
    )
