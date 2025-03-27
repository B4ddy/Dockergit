import logging
import json
from channels.middleware import BaseMiddleware


logger = logging.getLogger(__name__)

class WebSocketTrafficMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        async def new_receive():
            message = await receive()
            logger.info(f"Received from {scope['client']}: {message}")  # Log incoming message
            return message

        async def new_send(message):
            
            await send(message)

        # Use this if you are not decoding message on receive:
        await super().__call__(scope, new_receive, new_send)