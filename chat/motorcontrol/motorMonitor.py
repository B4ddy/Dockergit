import asyncio
import logging
import time
from collections import deque
from django.utils import timezone
from django.db import transaction

from ..models import protodata, baseuser, motorsession
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)

class MotorMonitor:
    def __init__(self, socket_manager, send_motor_value_callback, send_response_callback, stop_event):
        self.socket_manager = socket_manager
        self.send_motor_value = send_motor_value_callback
        self.send_response = send_response_callback
        self.stop_event = stop_event
        self.logging_bool = False
        self.user_id = 0
        self.previous_motor_registers = {}
        
        # Motor registers and values
        self.motor_registers = {}
        self.motor_values = {
            "voltage_logic": "411001",
            "actual_velocity": "4a0402",
          #  "temp_com_card": "411403",
            "temp_power_stage": "411401",
          #  "torqueconstant": "490106",
            
                 

        }
        self.motor_values_important = {
        #   "filtered_current":"426202",
             "phase_current": "426201",
            "actual_position": "476201",
            
        }
        self.all_motor_values = {
            **self.motor_values, **self.motor_values_important
        }
        self.reverse_motor_values = {
            v: k for k, v in self.all_motor_values.items()
        }
        
        # Addresses to ignore in logging
        self.log_ignore_addresses = {
            "476201", "426201", "4a0402", "411403","411401","411001"
        }
        self.db_write_interval = 20 
        self.data_buffer = deque(maxlen=5000) 
        
        # Cache for user and session objects
        self.user_cache = None
        self.session_cache = None
        self.last_cache_update = 0
        self.cache_ttl = 60  # Cache TTL in seconds
        
        # New: Track when to send batched data to websocket
        self.last_websocket_send_time = time.time()
        self.websocket_send_interval = 0.05  # Send every 20ms
        self.tag_for_db = False 


        # Consistency parameter.  Write to DB every Nth websocket send.
        self.db_write_frequency = 2  # Write every 5th websocket send
        self.websocket_send_counter = 0 
        self.db_write_flag = False 

    async def listen_for_motor_responses(self):
        try:
            loop = asyncio.get_event_loop()
            last_db_write_time = time.time()

            while not self.stop_event.is_set():
                # Run blocking recvfrom in a thread (UDP connectionless)
                data, addr = await loop.run_in_executor(None, self.socket_manager.receive, 2048)
                response_hex = data.hex()  # Convert bytes to hex
               
                # Parse response
                #header = response_hex[:25]  # First 25 chars of the hex string
               # response_type = response_hex[25:32]  # Chars 25-32
                address = response_hex[32:38]  # Chars 32-38

                # Look up the address name
                format_address = self.reverse_motor_values.get(address)

                if len(response_hex) > 38:
                    value_hex = response_hex[38:]
                    phase_current_address = self.all_motor_values.get("phase_current")
                    actualvelocity_address = self.all_motor_values.get("actual_velocity")
                    actualposition_address = self.all_motor_values.get("actual_position")
                    filtered_current_adress = self.all_motor_values.get("filtered_current")

                    # Convert hex to int, handling signed values for specific addresses
                    if address in [phase_current_address, actualvelocity_address, actualposition_address,filtered_current_adress] and address is not None:
                        value = int.from_bytes(bytes.fromhex(value_hex), byteorder='big', signed=True)
                        if address == actualposition_address:
                            value = (value % 241664) / 241664 * 1000
                        if address == actualposition_address:
                            value = round(value, 2)
                    else:
                        value = int(value_hex, 16)

                    value_str = str(value).ljust(15)

                    # Updated logging: Only log if address is not in ignore list
                    if address not in self.log_ignore_addresses:
                        logger.info(f"{format_address}  Wert = {value_str} time {time.time()}")
                    
                    # Update motor registers
                    self.motor_registers[address] = value

                # Check if it's time to send data to websocket
                current_time = time.time()
                if current_time - self.last_websocket_send_time >= self.websocket_send_interval:

                    # Create a copy of the motor registers for this websocket send
                    motor_data_copy = self.motor_registers.copy()

                    # Determine if this message should be tagged for DB writing
                    dbw_flag = False
                    if self.logging_bool and self.websocket_send_counter % self.db_write_frequency == 0:
                        dbw_flag = True

                    # Format data and send, regardless of changes
                    formatted_data = self.format_motor_data_for_websocket(motor_data_copy, dbw_flag, current_time)
                    await self.send_response(formatted_data)

                    # Increment counter
                    self.websocket_send_counter += 1

                    # Write to DB if needed
                    if self.logging_bool and self.websocket_send_counter % self.db_write_frequency == 0:
                        self.data_buffer.append({'data': motor_data_copy})
                        self.db_write_flag = True

                    self.last_websocket_send_time = current_time

                if self.db_write_flag:
                    await self.write_buffered_data_to_db()
                    self.db_write_flag = False

        except Exception as e:
            logger.error(f"Error in listen_for_motor_responses: {e}")

    def format_motor_data_for_websocket(self, motor_data, dbw_flag, timestamp):
        """
        Format motor data for the websocket. Always includes a timestamp and
        conditionally includes a 'dbw' flag if this data will be written to the database.
        """

        data = {
            'timestamp': timestamp
        }

        if dbw_flag:
            data['dbw'] = True

        #Always include motor data, even if unchanged.
        for name, address in self.all_motor_values.items():
            data[name] = motor_data.get(address, None)

        # Update the previous values
        self.previous_motor_registers.update(motor_data)

        return data

    async def send_motor_parameter_requests(self, param_dict, sleep_interval):
        try:
            while not self.stop_event.is_set():
                # Create parameter request commands
                commands = [
                    f"44424450000001000-10000000-3000000-{address}"
                    for address in param_dict.values()
                ]

                # Send batched commands
                async with asyncio.Semaphore(1):
                    for command in commands:
                        formatted_command = bytes.fromhex(command.replace('-', ''))
                        self.socket_manager.send(formatted_command)
                        await asyncio.sleep(0.01)  # Small delay between commands

                # Wait until next polling interval
                await asyncio.sleep(sleep_interval)

        except Exception as e:
            logger.error(f"Error in send_motor_parameter_requests: {e}")

    def get_all_motor_values(self):
        """Returns a copy of the all_motor_values dictionary."""
        return self.motor_registers.copy()  # Return a copy to prevent external modification

    @sync_to_async
    def _get_user_and_session(self):
        """Get and cache user and session objects"""
        current_time = time.time()

        # Check if cache needs refresh
        if (self.user_cache is None or self.session_cache is None or
                current_time - self.last_cache_update > self.cache_ttl):
            try:
                user = baseuser.objects.get(id=self.user_id)
                session = motorsession.objects.filter(user=user, is_active=True).first()

                if session:
                    self.user_cache = user
                    self.session_cache = session
                    self.last_cache_update = current_time
                    return user, session
                else:
                    logger.error(f"No active session found for user {self.user_id}")
                    return None, None
            except baseuser.DoesNotExist:
                logger.error(f"User with ID {self.user_id} does not exist")
                return None, None
            except Exception as e:
                logger.error(f"Error getting user and session: {e}")
                return None, None
        else:
            # Return cached values
            return self.user_cache, self.session_cache

    @sync_to_async
    def _bulk_create_proto_data(self, data_points, session):
        """Bulk create protodata objects"""
        try:
            with transaction.atomic():
                proto_data_objects = [
                    protodata(
                        actual_position=data.get("476201", 0),
                        actual_velocity=data.get("4a0402", 0),
                        phase_current=data.get("426201", 0),
                        voltage_logic=data.get("411001", 0),
                        session=session,
                        time=timezone.now()
                          # Assuming you want to record when it was inserted
                    ) for data in data_points
                ]

                # Use bulk_create for efficiency
                created = protodata.objects.bulk_create(proto_data_objects)
                return len(created)
        except Exception as e:
            logger.error(f"Error bulk creating protodata: {e}")
            return 0

    async def write_buffered_data_to_db(self):
        """Writes the buffered motor register data to the database in bulk."""
        if not self.data_buffer or not self.logging_bool:
            return  # Nothing to write

        try:
            # Get user and session (using cached values if available)
            _, session = await self._get_user_and_session()

            if not session:
                logger.error("Cannot write to database: No active session")
                return

            # Extract data points from buffer
            data_points = [item['data'] for item in self.data_buffer]

            # Bulk create in database
            num_created = await self._bulk_create_proto_data(data_points, session)

            if num_created > 0:
                # Clear buffer after successful write
                self.data_buffer.clear()
                logger.info(f"[DBW] Successfully wrote {num_created} data points to database") # Added Tag
            else:
                logger.warning("[DBW] No data points written to database.")  # Added Tag, in case of failure

        except Exception as db_error:
            logger.error(f"[DBW] Error writing to database: {db_error}")  # Added Tag

    async def logging_bool_on(self, textdata):
        self.user_id = textdata["message"]
    
         # First check if there's an active session before enabling logging
        ser, session = await self._get_user_and_session()
    
        if not session:
            logger.warning(f"Cannot enable logging: No active session for user {self.user_id}")
            return False  # Return False to indicate logging wasn't enabled
        self.logging_bool = True
        self.websocket_send_counter = 0
        logger.info(f"Logging enabled for user {self.user_id}")
        return True  # Return True to indicate logging was enabled

        

    async def logging_bool_off(self):
        # Write any remaining data before turning off logging
        if self.data_buffer:
            await self.write_buffered_data_to_db()

        self.logging_bool = False
        logger.info("Logging disabled")