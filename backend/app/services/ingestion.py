import os
import uuid
import anyio
from fastapi import UploadFile, HTTPException
from app.core.config import settings

class IngestionService:
    ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}
    
    async def save_uploaded_file(self, file: UploadFile, workspace_id: int) -> dict:
        """Asynchronously streams and saves an uploaded file to the local workspace folder."""
        filename = os.path.basename(file.filename)
        _, ext = os.path.splitext(filename.lower())
        
        if ext not in self.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File extension '{ext}' is not supported. Please upload CSV, Excel, or JSON."
            )
        
        # Build local storage path mirroring S3
        workspace_dir = os.path.join(settings.STORAGE_DIR, f"workspace_{workspace_id}", "datasets")
        os.makedirs(workspace_dir, exist_ok=True)
        
        file_uuid = str(uuid.uuid4())
        safe_filename = f"{file_uuid}_{filename}"
        storage_path = os.path.abspath(os.path.join(workspace_dir, safe_filename))
        
        file_size = 0
        try:
            # We open the file asynchronously using anyio
            async with await anyio.open_file(storage_path, "wb") as out_file:
                while chunk := await file.read(1024 * 1024):  # 1MB chunks
                    await out_file.write(chunk)
                    file_size += len(chunk)
        except Exception as e:
            if os.path.exists(storage_path):
                os.remove(storage_path)
            raise HTTPException(
                status_code=500,
                detail=f"Disk I/O error occurred during file ingestion: {str(e)}"
            )
        
        # Reset file seek for subsequent reads in the same request if needed
        await file.seek(0)
        
        return {
            "uuid": file_uuid,
            "filename": filename,
            "storage_path": storage_path,
            "file_size": file_size,
            "content_type": file.content_type,
        }

ingestion_service = IngestionService()
