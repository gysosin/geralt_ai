"""
MinIO Client

Provides MinIO object storage connection with OOP wrapper.
"""
import logging
from typing import Optional, BinaryIO

from minio import Minio

from config import Config


class MinioClient:
    """
    MinIO client wrapper with connection management.
    
    Provides:
    - Bucket management
    - Object operations
    - Error handling
    """
    
    _instance: Optional["MinioClient"] = None
    
    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._client = Minio(
            Config.MINIO_ENDPOINT,
            access_key=Config.MINIO_ACCESS_KEY,
            secret_key=Config.MINIO_SECRET_KEY,
            secure=False,
        )
        self.bucket_name = Config.BUCKET_NAME
        self.logger.info(f"MinIO connected to {Config.MINIO_ENDPOINT}")
    
    @classmethod
    def get_instance(cls) -> "MinioClient":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @property
    def client(self):
        """Get raw MinIO client."""
        return self._client
    
    def ensure_bucket(self, bucket_name: str = None) -> bool:
        """Ensure bucket exists, create if not."""
        bucket = bucket_name or self.bucket_name
        if not self._client.bucket_exists(bucket):
            self._client.make_bucket(bucket)
            self.logger.info(f"Created bucket: {bucket}")
            return True
        return False
    
    def put_object(self, bucket: str, path: str, data: BinaryIO, length: int, **kwargs):
        """Upload object to bucket."""
        return self._client.put_object(bucket, path, data, length, **kwargs)
    
    def get_object(self, bucket: str, path: str):
        """Get object from bucket."""
        return self._client.get_object(bucket, path)
    
    def remove_object(self, bucket: str, path: str):
        """Remove object from bucket."""
        return self._client.remove_object(bucket, path)
    
    def presigned_get_object(self, bucket: str, path: str, expires=None):
        """Get presigned URL for object."""
        return self._client.presigned_get_object(bucket, path, expires=expires)
    
    def __getattr__(self, name):
        """Proxy other methods to underlying client."""
        return getattr(self._client, name)


# Singleton access
_minio_client_instance: Optional[MinioClient] = None


def get_minio_client() -> MinioClient:
    """Get or create the MinIO client singleton."""
    global _minio_client_instance
    if _minio_client_instance is None:
        _minio_client_instance = MinioClient()
    return _minio_client_instance


# Backwards compatibility
minio_client = None


def init_minio():
    """Initialize MinIO client for backwards compatibility."""
    global minio_client
    minio_client = get_minio_client().client
    return minio_client
