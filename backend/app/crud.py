import random
import string
from sqlalchemy.orm import Session
from typing import List, Optional
from . import models, schemas

def generate_id(prefix: str, length: int = 13) -> str:
    """Generate a random AWS-like ID (e.g. Z01485693R4P9)"""
    chars = string.ascii_uppercase + string.digits
    return prefix + "".join(random.choices(chars, k=length))

def normalize_dns_name(name: str) -> str:
    """Ensure DNS names end with a dot"""
    name = name.strip()
    if not name.endswith("."):
        name += "."
    return name

# User CRUD
def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate, aws_account_id: str = "1234-5678-9012"):
    # Simple plain text or basic hash. Let's do simple hashing for safety.
    # In a real app we'd use bcrypt, but simple sha256 via hashlib keeps things 0-dependency.
    import hashlib
    password_hash = hashlib.sha256(user.password.encode()).hexdigest()
    
    db_user = models.User(
        username=user.username,
        password_hash=password_hash,
        aws_account_id=aws_account_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Hosted Zone CRUD
def get_hosted_zone(db: Session, zone_id: str):
    return db.query(models.HostedZone).filter(models.HostedZone.id == zone_id).first()

def get_hosted_zones(db: Session, query: Optional[str] = None, skip: int = 0, limit: int = 100):
    db_query = db.query(models.HostedZone)
    if query:
        search_pattern = f"%{query}%"
        db_query = db_query.filter(
            (models.HostedZone.name.like(search_pattern)) |
            (models.HostedZone.description.like(search_pattern))
        )
    return db_query.offset(skip).limit(limit).all()

def create_hosted_zone(db: Session, zone: schemas.HostedZoneCreate):
    zone_id = generate_id("Z")
    normalized_name = normalize_dns_name(zone.name)
    
    db_zone = models.HostedZone(
        id=zone_id,
        name=normalized_name,
        description=zone.description,
        type=zone.type,
        vpc_id=zone.vpc_id if zone.type == "Private" else None,
        vpc_region=zone.vpc_region if zone.type == "Private" else None,
        record_count=2  # Starts with default NS and SOA
    )
    db.add(db_zone)
    
    # 1. Create Default NS Record
    # Generate 4 random AWS name servers
    ns_servers = [
        f"ns-{random.randint(100, 2000)}.awsdns-{random.randint(10, 99)}.com.",
        f"ns-{random.randint(100, 2000)}.awsdns-{random.randint(10, 99)}.org.",
        f"ns-{random.randint(10, 99)}.awsdns-{random.randint(10, 99)}.co.uk.",
        f"ns-{random.randint(100, 2000)}.awsdns-{random.randint(10, 99)}.net."
    ]
    ns_record = models.DNSRecord(
        id=generate_id("R"),
        hosted_zone_id=zone_id,
        name=normalized_name,
        type="NS",
        routing_policy="Simple",
        ttl=172800,  # 2 days default in Route53
        value="\n".join(ns_servers),
        alias=False
    )
    db.add(ns_record)
    
    # 2. Create Default SOA Record
    soa_val = f"{ns_servers[0]} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
    soa_record = models.DNSRecord(
        id=generate_id("R"),
        hosted_zone_id=zone_id,
        name=normalized_name,
        type="SOA",
        routing_policy="Simple",
        ttl=900,
        value=soa_val,
        alias=False
    )
    db.add(soa_record)
    
    db.commit()
    db.refresh(db_zone)
    return db_zone

def update_hosted_zone(db: Session, zone_id: str, zone_in: schemas.HostedZoneUpdate):
    db_zone = get_hosted_zone(db, zone_id)
    if not db_zone:
        return None
    
    if zone_in.description is not None:
        db_zone.description = zone_in.description
        
    db.commit()
    db.refresh(db_zone)
    return db_zone

def delete_hosted_zone(db: Session, zone_id: str):
    db_zone = get_hosted_zone(db, zone_id)
    if not db_zone:
        return False
    
    db.delete(db_zone)
    db.commit()
    return True

# DNS Record CRUD
def get_dns_record(db: Session, record_id: str):
    return db.query(models.DNSRecord).filter(models.DNSRecord.id == record_id).first()

def get_dns_records_by_zone(
    db: Session, 
    zone_id: str, 
    query: Optional[str] = None, 
    record_type: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100
):
    db_query = db.query(models.DNSRecord).filter(models.DNSRecord.hosted_zone_id == zone_id)
    
    if record_type:
        db_query = db_query.filter(models.DNSRecord.type == record_type)
        
    if query:
        search_pattern = f"%{query}%"
        db_query = db_query.filter(
            (models.DNSRecord.name.like(search_pattern)) |
            (models.DNSRecord.value.like(search_pattern))
        )
        
    return db_query.offset(skip).limit(limit).all()

def create_dns_record(db: Session, zone_id: str, record: schemas.DNSRecordCreate):
    db_zone = get_hosted_zone(db, zone_id)
    if not db_zone:
        return None
        
    record_id = generate_id("R")
    
    # Normalize DNS record name
    normalized_name = normalize_dns_name(record.name)
    # If the record name is empty/subdomain, construct it using the zone name
    if normalized_name == ".":
        normalized_name = db_zone.name
    elif not normalized_name.endswith(db_zone.name):
        # E.g. record name "www", zone "example.com." -> "www.example.com."
        normalized_name = f"{normalized_name.rstrip('.')}.{db_zone.name}"
        
    db_record = models.DNSRecord(
        id=record_id,
        hosted_zone_id=zone_id,
        name=normalized_name,
        type=record.type,
        routing_policy=record.routing_policy,
        ttl=record.ttl,
        value=record.value.strip(),
        weight=record.weight,
        set_id=record.set_id,
        alias=record.alias,
        alias_target=record.alias_target,
        health_check_id=record.health_check_id
    )
    
    db.add(db_record)
    
    # Update zone record count
    db_zone.record_count += 1
    
    db.commit()
    db.refresh(db_record)
    return db_record

def update_dns_record(db: Session, record_id: str, record_in: schemas.DNSRecordUpdate):
    db_record = get_dns_record(db, record_id)
    if not db_record:
        return None
        
    # Update fields
    for field, val in record_in.model_dump(exclude_unset=True).items():
        if field == "name" and val is not None:
            db_record.name = normalize_dns_name(val)
        else:
            setattr(db_record, field, val)
            
    db.commit()
    db.refresh(db_record)
    return db_record

def delete_dns_record(db: Session, record_id: str):
    db_record = get_dns_record(db, record_id)
    if not db_record:
        return False
        
    zone_id = db_record.hosted_zone_id
    db_zone = get_hosted_zone(db, zone_id)
    
    db.delete(db_record)
    
    if db_zone and db_zone.record_count > 0:
        db_zone.record_count -= 1
        
    db.commit()
    return True

def bulk_delete_records(db: Session, record_ids: List[str]):
    count = 0
    # Group by zone to update counters accurately
    zones_to_update = {}
    
    for r_id in record_ids:
        db_record = get_dns_record(db, r_id)
        if db_record:
            z_id = db_record.hosted_zone_id
            zones_to_update[z_id] = zones_to_update.get(z_id, 0) + 1
            db.delete(db_record)
            count += 1
            
    for z_id, del_count in zones_to_update.items():
        db_zone = get_hosted_zone(db, z_id)
        if db_zone:
            db_zone.record_count = max(0, db_zone.record_count - del_count)
            
    db.commit()
    return count
