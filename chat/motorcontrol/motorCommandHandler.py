import asyncio

delay = 0.001  # Delay between commands

class MotorCommandHandler:
    def __init__(self, socketManager):
        self.socketManager = socketManager
        self.current_velocity = 0
        self.current_hex = "00000000"  # Default current hex
        self.semaphore = asyncio.Semaphore(1)



        # Base parts of the protocol
        base_protocol = "44424450000001000"
        read_only = "10000000"
        read_write = "30000000"

        # Memory type areas
        read_only_int32 = "3000000"
        read_only_uint32 = "3000000"
        read_write_uint8 = "4000000"
        read_write_int32 = "7000000"
        read_write_uint16 = "5000000"
        
        # Command dictionary
        self.command_dict = {
            'velocity_mode':  ["44424450000001000-30000000-4000000-4003-01-05", "44424450000001000-30000000-4000000-4000-01-01",   #special velocity mode, clear error, enable motor
                               "44424450000001000-30000000-4000000-4004-01-01"],
           
            'current_mode':   ["44424450000001000-30000000-4000000-4003-01-02", "44424450000001000-30000000-4000000-4000-01-01",   #special current mode, clear error, enable motor
                               "44424450000001000-30000000-4000000-4004-01-01", "44424450000001000-30000000-7000000-4204-01-0200"], 
                              
            
            'x':              ["44424450000001000-30000000-4000000-4004-01-00"],
            'f':              ["44424450000001000-30000000-7000000-4300-01-00000539"],
            'r':              ["44424450000001000-30000000-7000000-4300-01-FFFFF63C"],
            'init_packet':    ["48494e49000003e80000000113f3bf8a0000006000000000a9fe3f0f0000e5250000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"],
            "quick_start":    ["44424450000001000-30000000-4000000-4000-02-0115"],
            "set_position_0":    ["44424450000001000-30000000-7000000-4762-01-00000000"],

            
        }

    def to_twos_complement(self, value, bits):
        """Convert an integer to its two's complement representation."""
        if value < 0:
            value = (1 << bits) + value
        # Create format string for the specified number of bits
        format_string = f'0{bits // 4}X'
        return format(value, format_string)

    async def send_command(self, command_list):
        """Sends a list of commands, acquiring the semaphore and releasing it."""
        async with self.semaphore:
            for command in command_list:
                # Check if command is a lambda or function
                if callable(command):
                    # If it's a callable, pass current_hex as argument
                    command = command(self.current_hex)
                
                # Replace dashes and convert to bytes
                formatted_command = bytes.fromhex(command.replace('-', ''))
                self.socketManager.send(formatted_command)
                await asyncio.sleep(delay)  # Add small delay between commands

    async def handle_command(self, command, send_response_callback):
        if command in self.command_dict:
            command_list = self.command_dict[command]
            await self.send_command(command_list)
            await send_response_callback({'status': 'Command sent!'})
        else:
            await send_response_callback({'status': 'Invalid command.'})

    async def handle_set_velocity(self, target_velocity, send_response_callback):
        # Convert target velocity to hex and create command
        velocity_hex = self.to_twos_complement(int(target_velocity), 32)
        command = f"44424450000001000-30000000-7000000-4300-01-{velocity_hex}"
        await self.send_command([command])
        self.current_velocity = int(target_velocity)
        await send_response_callback({'status': f'Set velocity to {target_velocity}'})

    async def handle_set_current(self, current, send_response_callback):
        self.current_hex = self.to_twos_complement(int(current), 32)
        command = f"44424450000001000-30000000-7000000-4200-01-{self.current_hex}"
        await self.send_command([command])
        await send_response_callback({'status': f'Set current to {current}'})