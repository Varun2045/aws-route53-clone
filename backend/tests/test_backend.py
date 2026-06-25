import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app import crud, auth, schemas, import_export

# Set up an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db():
    # Create the tables
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
        Base.metadata.drop_all(bind=engine)

def test_auth_token_generation_and_verification():
    username = "admin-test"
    token = auth.create_session_token(username)
    
    assert token is not None
    assert "." in token
    
    # Valid token verification
    verified_username = auth.verify_session_token(token)
    assert verified_username == username
    
    # Invalid token verification
    assert auth.verify_session_token("invalid.token") is None
    assert auth.verify_session_token("invalid_token") is None

def test_user_creation_and_retrieval(db):
    user_in = schemas.UserCreate(username="testuser", password="testpassword")
    user = crud.create_user(db, user_in, aws_account_id="9876-5432-1098")
    
    assert user.id is not None
    assert user.username == "testuser"
    assert user.aws_account_id == "9876-5432-1098"
    assert user.password_hash != "testpassword"  # should be hashed!
    
    retrieved_user = crud.get_user_by_username(db, "testuser")
    assert retrieved_user is not None
    assert retrieved_user.id == user.id

def test_hosted_zone_creation_adds_apex_ns_and_soa(db):
    zone_in = schemas.HostedZoneCreate(
        name="testzone.com",
        description="Testing zone creation",
        type="Public"
    )
    
    zone = crud.create_hosted_zone(db, zone_in)
    
    assert zone.id.startswith("Z")
    assert zone.name == "testzone.com."  # normalised trailing dot
    assert zone.record_count == 2
    
    # Check that default records are added
    records = crud.get_dns_records_by_zone(db, zone.id)
    assert len(records) == 2
    
    types = [r.type for r in records]
    assert "NS" in types
    assert "SOA" in types
    
    # Verify apex records are associated with the zone domain name
    for r in records:
        assert r.name == "testzone.com."

def test_dns_record_creation_normalization_and_routing(db):
    # Create zone first
    zone = crud.create_hosted_zone(db, schemas.HostedZoneCreate(name="example.com"))
    
    # Create sub-domain record without trailing dot and suffix
    record_in = schemas.DNSRecordCreate(
        name="www",
        type="A",
        routing_policy="Simple",
        ttl=300,
        value="192.168.1.1"
    )
    
    record = crud.create_dns_record(db, zone.id, record_in)
    
    assert record.id.startswith("R")
    assert record.name == "www.example.com."  # should append zone name and add trailing dot!
    assert record.type == "A"
    assert record.value == "192.168.1.1"
    
    # Verify zone record count updated
    updated_zone = crud.get_hosted_zone(db, zone.id)
    assert updated_zone.record_count == 3

def test_bind_export(db):
    zone = crud.create_hosted_zone(db, schemas.HostedZoneCreate(name="myzone.org"))
    
    # Add A record
    crud.create_dns_record(db, zone.id, schemas.DNSRecordCreate(
        name="api",
        type="A",
        routing_policy="Simple",
        ttl=600,
        value="10.0.0.5\n10.0.0.6"
    ))
    
    records = crud.get_dns_records_by_zone(db, zone.id)
    bind_text = import_export.export_to_bind(zone.name, records)
    
    assert "$ORIGIN myzone.org." in bind_text
    assert "api\t600\tIN\tA\t10.0.0.5" in bind_text
    assert "api\t600\tIN\tA\t10.0.0.6" in bind_text
    assert "@\t900\tIN\tSOA\t" in bind_text  # Apex SOA record
