from django.urls import re_path 
from . import motorConsumer

websocket_urlpatterns = [
    re_path(r'ws/motor_control/$', motorConsumer.MotorConsumer.as_asgi())
]

