import json
import logging
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.database import AsyncSessionLocal
from app.models.canvas import CanvasComment

logger = logging.getLogger("app.api.v1.websocket")

router = APIRouter()

class CanvasConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, workspace_id: int):
        await websocket.accept()
        if workspace_id not in self.active_connections:
            self.active_connections[workspace_id] = []
        self.active_connections[workspace_id].append(websocket)
        logger.info(f"Client connected to workspace {workspace_id} socket room. Active connections count: {len(self.active_connections[workspace_id])}")

    async def disconnect(self, websocket: WebSocket, workspace_id: int):
        if workspace_id in self.active_connections:
            if websocket in self.active_connections[workspace_id]:
                self.active_connections[workspace_id].remove(websocket)
            logger.info(f"Client disconnected from workspace {workspace_id}. Active connections count: {len(self.active_connections[workspace_id])}")

    async def broadcast(self, workspace_id: int, message: dict, exclude_websocket: WebSocket = None):
        if workspace_id in self.active_connections:
            for connection in self.active_connections[workspace_id]:
                if connection != exclude_websocket:
                    try:
                        await connection.send_json(message)
                    except Exception as e:
                        logger.error(f"Error sending message to client: {e}")

manager = CanvasConnectionManager()

@router.websocket("/ws/canvas/{workspace_id}")
async def websocket_endpoint(websocket: WebSocket, workspace_id: int):
    """
    WebSocket endpoint serving multiplayer canvas syncing.
    Synchronizes cursor positions, What-If weights changes, and sticky comment pinning.
    """
    await manager.connect(websocket, workspace_id)
    try:
        while True:
            # Continuously listen for incoming JSON message updates from client
            data = await websocket.receive_json()
            msg_type = data.get("type")
            payload = data.get("payload", {})
            
            # Form message envelope to broadcast
            broadcast_payload = {
                "type": msg_type,
                "payload": payload
            }
            
            if msg_type == "PIN_COMMENT":
                # Save sticky comment to database before broadcasting
                user_email = payload.get("user_email")
                chart_id = payload.get("chart_id")
                comment_text = payload.get("comment_text")
                x_pos = float(payload.get("x_pos", 0.0))
                y_pos = float(payload.get("y_pos", 0.0))
                
                async with AsyncSessionLocal() as db:
                    comment = CanvasComment(
                        workspace_id=workspace_id,
                        user_email=user_email,
                        chart_id=chart_id,
                        comment_text=comment_text,
                        x_pos=x_pos,
                        y_pos=y_pos
                    )
                    db.add(comment)
                    await db.commit()
                    await db.refresh(comment)
                    
                    # Update payload with database-saved comment ID
                    payload["id"] = comment.id
                    broadcast_payload["payload"] = payload
                    
            await manager.broadcast(workspace_id, broadcast_payload, exclude_websocket=websocket)
            
    except WebSocketDisconnect:
        await manager.disconnect(websocket, workspace_id)
    except Exception as e:
        logger.error(f"WebSocket execution error on workspace {workspace_id}: {e}")
        await manager.disconnect(websocket, workspace_id)
