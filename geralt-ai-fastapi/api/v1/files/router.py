from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from core.clients.minio_client import get_minio_client
from core.config import settings
import mimetypes

router = APIRouter()

@router.get("/{file_path:path}")
async def get_file(file_path: str):
    """
    Serve a file from MinIO.
    """
    client = get_minio_client().client
    bucket = settings.MINIO_BUCKET
    
    try:
        # Check if object exists
        try:
             client.stat_object(bucket, file_path)
        except Exception:
             raise HTTPException(status_code=404, detail="File not found")

        # Get object
        response = client.get_object(bucket, file_path)
        
        # Generator to stream valid chunks
        def iterfile():
            try:
                for chunk in response.stream(32*1024):
                    yield chunk
            finally:
                response.close()
                response.release_conn()

        # Guess mime type
        content_type, _ = mimetypes.guess_type(file_path)
        if not content_type:
            content_type = "application/octet-stream"

        return StreamingResponse(
            iterfile(),
            media_type=content_type
        )
    except HTTPException:
        raise
    except Exception as e:
        # Creating a simplified generic error on 500
        raise HTTPException(status_code=500, detail=f"Error serving file: {str(e)}")
