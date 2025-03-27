# File: motor_control/socket_manager.py
# Manages socket connections and communications

import socket
import logging

logger = logging.getLogger(__name__)

class SocketManager:
    def __init__(self, ip, port):
        self.ip = ip
        self.port = port
        self.socket = None
        
    def connect(self):
        """Initialize and connect the socket."""
        try:
            # AF_INET = IPv4, SOCK_DGRAM = UDP
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.socket.connect((self.ip, self.port))
            logger.info(f"Socket connected to {self.ip}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Socket connection error: {e}")
            return False
            
    def send(self, data):
        """Send data through the socket."""
        if self.socket:
            try:
                self.socket.send(data)
                return True
            except Exception as e:
                logger.error(f"Socket send error: {e}")
                return False
        return False
        
    def receive(self, buffer_size):
        """Receive data from the socket."""
        if self.socket:
            try:
                return self.socket.recvfrom(buffer_size)
            except Exception as e:
                logger.error(f"Socket receive error: {e}")
                return None, None
        return None, None
        
    def close(self):
        """Close the socket connection."""
        if self.socket:
            try:
                self.socket.close()
                self.socket = None
                logger.info("Socket connection closed")
            except Exception as e:
                logger.error(f"Socket close error: {e}")