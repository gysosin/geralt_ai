"""
Create Admin User Script

Creates a new admin user directly in MongoDB.
"""
import sys
import os
import logging
from passlib.context import CryptContext
from datetime import datetime

# Add parent dir to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.database import users_collection

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Password hashing context (same as auth_service.py)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_admin():
    email = "admin@geraltai.com"
    username = "admin" # Simple username for admin
    password = "admin"
    firstname = "Admin"
    lastname = "User"
    role = "admin"

    logger.info(f"Creating admin user: {email}...")

    # Check if exists
    existing = users_collection.find_one({
        "$or": [{"username": username}, {"email": email}]
    })

    if existing:
        logger.warning("User already exists!")
        # Optional: Update password if exists?
        # users_collection.update_one({"_id": existing["_id"]}, {"$set": {"password": pwd_context.hash(password), "role": "admin"}})
        # logger.info("Updated existing user password and role.")
        return

    # Create new user
    hashed_password = pwd_context.hash(password)
    
    new_user = {
        "username": username,
        "email": email,
        "password": hashed_password,
        "firstname": firstname,
        "lastname": lastname,
        "role": role,
        "created_at": datetime.utcnow(),
        "is_active": True,
        "tenant_id": "default" # Ensure tenant_id is set for multi-tenancy logic
    }

    try:
        users_collection.insert_one(new_user)
        logger.info(f"✓ Admin user created successfully.")
        logger.info(f"  Email: {email}")
        logger.info(f"  Password: {password}")
    except Exception as e:
        logger.error(f"✗ Failed to create user: {e}")

if __name__ == "__main__":
    create_admin()
