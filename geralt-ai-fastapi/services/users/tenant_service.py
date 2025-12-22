"""
Tenant Service

Handles tenant management operations.
"""
from typing import Dict, List, Optional, Any
from uuid import uuid4
from datetime import datetime

from models.database import tenants_collection
from services.bots import BaseService, ServiceResult


class TenantService(BaseService):
    """
    Service for managing tenants.
    """
    
    def __init__(self):
        super().__init__()
        self.db = tenants_collection
    
    def create(self, identity: str, data: Dict[str, Any]) -> ServiceResult:
        """Create a new tenant."""
        try:
            username = self.extract_username(identity)
            
            tenant_name = data.get("company")
            email = data.get("email")
            
            if not tenant_name or not email:
                return ServiceResult.fail("Company name and email are required", 400)
            
            tenant_id = str(uuid4())
            
            tenant = {
                "tenant_id": tenant_id,
                "name": tenant_name,
                "email": email,
                "created_by": username,
                "created_at": datetime.utcnow(),
                "users": [{"username": username, "role": "admin"}]
            }
            
            self.db.insert_one(tenant)
            self.log_operation("create_tenant", username=username, tenant_id=tenant_id)
            
            return ServiceResult.ok({
                "message": "Tenant created successfully",
                "tenant_id": tenant_id,
                "name": tenant_name
            })
            
        except Exception as e:
            self.logger.error(f"Error creating tenant: {e}")
            return ServiceResult.fail(str(e), 500)
            
    def list(self, identity: str) -> ServiceResult:
        """List tenants for a user."""
        try:
            username = self.extract_username(identity)
            
            tenants = list(self.db.find({
                "users.username": username
            }))
            
            result = []
            for t in tenants:
                result.append({
                    "tenant_id": t["tenant_id"],
                    "name": t["name"],
                    "role": next((u["role"] for u in t["users"] if u["username"] == username), "user")
                })
                
            return ServiceResult.ok(result)
            
        except Exception as e:
            self.logger.error(f"Error listing tenants: {e}")
            return ServiceResult.fail(str(e), 500)


# Singleton instance
_tenant_service_instance: Optional[TenantService] = None


def get_tenant_service() -> TenantService:
    """Get or create the tenant service singleton."""
    global _tenant_service_instance
    if _tenant_service_instance is None:
        _tenant_service_instance = TenantService()
    return _tenant_service_instance
