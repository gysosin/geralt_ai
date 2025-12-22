import socketio
from config import Config

# Construct the Redis URL using Config settings
redis_url = Config.get_redis_url()

# 1. Main Async Server (to be mounted in FastAPI)
sio_server = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    client_manager=socketio.AsyncRedisManager(redis_url)
)
sio_app = socketio.ASGIApp(sio_server)

# 2. Sync Manager for Services
# This allows synchronous services to emit events via Redis to the Async Server
# write_only=True means it doesn't listen for events, just sends.
_sync_manager = socketio.RedisManager(redis_url, write_only=True)

class SocketIOWrapper:
    """Wrapper to maintain compatibility with existing service calls."""
    
    def emit(self, event: str, data: dict, room: str = None, namespace: str = None):
        """Emit event via Redis manager."""
        _sync_manager.emit(event, data, room=room, namespace=namespace or '/')

# Singleton instance to be imported by services
socketio = SocketIOWrapper()