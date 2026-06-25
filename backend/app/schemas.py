from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    aws_account_id: str

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

# DNS Record Schemas
class DNSRecordBase(BaseModel):
    name: str  # e.g., www.example.com.
    type: str  # A, AAAA, CNAME, etc.
    routing_policy: str = "Simple"
    ttl: int = 300
    value: str  # Newline-separated list of record values
    weight: Optional[int] = None
    set_id: Optional[str] = None
    alias: bool = False
    alias_target: Optional[str] = None
    health_check_id: Optional[str] = None

class DNSRecordCreate(DNSRecordBase):
    pass

class DNSRecordUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    routing_policy: Optional[str] = None
    ttl: Optional[int] = None
    value: Optional[str] = None
    weight: Optional[int] = None
    set_id: Optional[str] = None
    alias: Optional[bool] = None
    alias_target: Optional[str] = None
    health_check_id: Optional[str] = None

class DNSRecordResponse(DNSRecordBase):
    id: str
    hosted_zone_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Hosted Zone Schemas
class HostedZoneBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str = "Public"  # Public or Private
    vpc_id: Optional[str] = None
    vpc_region: Optional[str] = None

class HostedZoneCreate(HostedZoneBase):
    pass

class HostedZoneUpdate(BaseModel):
    description: Optional[str] = None

class HostedZoneResponse(HostedZoneBase):
    id: str
    record_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class HostedZoneDetailResponse(HostedZoneResponse):
    records: List[DNSRecordResponse] = []
