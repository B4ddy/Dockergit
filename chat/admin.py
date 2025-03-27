from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import baseuser, motorsession

# Register User model
class CustomUserAdmin(UserAdmin):
    model = baseuser
admin.site.register(baseuser, CustomUserAdmin)

# Register motorsession model with appropriate admin class
class MotorSessionAdmin(admin.ModelAdmin):
    model=motorsession

admin.site.register(motorsession, MotorSessionAdmin)