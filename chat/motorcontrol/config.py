# motor_control/config.py
from dataclasses import dataclass
from typing import Dict, List, Optional

@dataclass
class MotorRegisterConfig:
    """Configuration for motor registers and monitoring parameters"""
    name: str
    address: str
    polling_interval: float = 0.3
    is_signed: bool = False
    scale_factor: float = 1.0
    log_threshold: Optional[float] = None
    
class MotorMonitorConfig:
    """Centralized configuration for motor monitoring"""
    
    # Predefined motor register configurations
    REGISTER_CONFIGS = {
        "voltage_logic": MotorRegisterConfig(
            name="voltage_logic", 
            address="411001", 
            polling_interval=0.5
        ),
        "actual_velocity": MotorRegisterConfig(
            name="actual_velocity", 
            address="4a0402", 
            is_signed=True,
            log_threshold=10.0
        ),
        "phase_current": MotorRegisterConfig(
            name="phase_current", 
            address="426201", 
            is_signed=True,
            polling_interval=0.2,
            log_threshold=5.0
        ),
        "actual_position": MotorRegisterConfig(
            name="actual_position", 
            address="476201", 
            is_signed=True,
            scale_factor=1000/241664,
            log_threshold=50.0
        )
    }

    @classmethod
    def get_register_config(cls, name: str) -> MotorRegisterConfig:
        """Retrieve a specific register configuration"""
        return cls.REGISTER_CONFIGS.get(name)

    @classmethod
    def get_all_register_configs(cls) -> Dict[str, MotorRegisterConfig]:
        """Get all register configurations"""
        return cls.REGISTER_CONFIGS