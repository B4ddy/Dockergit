# File: motor_control/consumer.py
# Main WebSocket consumer that coordinates all components

import asyncio
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from .motorcontrol.motorCommandHandler import MotorCommandHandler
from .motorcontrol.motorMonitor import MotorMonitor
from .motorcontrol.socketManager import SocketManager
from .motorcontrol import startmotor

logger = logging.getLogger(__name__)

class MotorConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.room_group_name = 'motor_control'
        self.stop_event = asyncio.Event()
        
        # Initialize components
        self.socketManager = SocketManager("169.254.0.1", 18385)
        self.commands = MotorCommandHandler(self.socketManager)
        self.monitor = None  # Will be initialized after connection
        self.currentvalues= {}

    async def connect(self):
        # Add channel to group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name 
        )

        # Connect socket
        self.socketManager.connect()
        
        # Initialize monitor after socket is connected
        self.monitor = MotorMonitor(
            self.socketManager, 
            self.send_motor_value, 
            self.send_response,
            self.stop_event
        )
        
        
        # Start background tasks
        asyncio.create_task(self.monitor.listen_for_motor_responses())
        asyncio.create_task(self.monitor.send_motor_parameter_requests(
           self.monitor.motor_values, 0.3))                                
        asyncio.create_task(self.monitor.send_motor_parameter_requests(
            self.monitor.motor_values_important, 0.08))  
        self.currentvalues=self.monitor.motor_registers             # how many packets per second?   1/0.3 =3.33 P/s   + 1/0.07 = 14.2857 P/s 14.2857+3.33 = 17.6157 P/s     Der Motor kriegt jede Sekun

        # Accept the websocket connection
        await self.accept()
        
        # Send initial packet
        await self.commands.send_command([self.commands.command_dict['init_packet'][0]])

    async def disconnect(self, close_code):
        self.stop_event.set()

        for task in asyncio.all_tasks():
            if task != asyncio.current_task():
                task.cancel()
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        self.socketManager.close()

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message_type = text_data_json['type']
        

        if message_type == 'command':
            command = text_data_json['command']
            await self.commands.handle_command(command, self.send_response)
        elif message_type == 'set_velocity':
            velocity = text_data_json['velocity']
            await self.commands.handle_set_velocity(velocity, self.send_response)
        elif message_type == 'set_current':
            current = text_data_json['current']
            await self.commands.handle_set_current(current, self.send_response)
        elif message_type == 'boot':
            logger.info("Starting motor initialization")
            interface_name = r"\Device\NPF_{DD60A1ED-AE1D-41CF-B3AD-E39AA34DDF68}"
            startmotor.send_hini_packets(interface_name)
            logger.info("Motor initialization completed")
        elif message_type == "start_logging":
            success = await self.monitor.logging_bool_on(text_data_json)
            if success:
                await self.send_response({"type": "logging_status", "status": "started"})
            else:
                await self.send_response({"type": "logging_status", "status": "failed", "reason": "No active session"})
        elif message_type == "stop_logging":
            await self.monitor.logging_bool_off()

    async def send_motor_value(self, key, value):
        await self.channel_layer.group_send(
            self.room_group_name, 
            {'type': 'motor_value', 'key': key, 'value': value}
        )

    async def send_response(self, message):
        await self.send(text_data=json.dumps(message))

    async def motor_value(self, event):
        key = event['key']
        value = event['value']
        await self.send(text_data=json.dumps({
            'type': key,
            'value': value,
        }))