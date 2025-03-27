from datetime import datetime
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings  # Import settings for lazy user reference


class baseuser(AbstractUser):
    
    class Genders(models.TextChoices):
        MANN = 'MANN', 'MANN'
        FRAU = 'FRAU', 'FRAU'
        DIVERS = 'DIVERS', 'DIVERS'

    password = None
    USERNAME_FIELD = "username"
    
    height = models.FloatField(null=True, blank=True)
    oberschenkellänge = models.FloatField(null=True, blank=True)
    unterschenkel = models.FloatField(null=True, blank=True)
    schuhgröße = models.FloatField(null=True, blank=True)
    oberkörper = models.FloatField(null=True, blank=True)
    armlänge = models.FloatField(null=True, blank=True)
    gewicht = models.FloatField(null=True, blank=True)
    geburtsdatum = models.DateField(null=True, blank=True)
    geschlecht = models.CharField(max_length=6, null=True, blank=True, choices=Genders.choices)
    sessioncount = models.IntegerField(null=True, blank=True)
    rollstuhl = models.BooleanField(null=True, blank=True)

    groups = models.ManyToManyField(
        'auth.Group', 
        related_name='baseuser_set',  
        blank=True
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission', 
        related_name='baseuser_permissions',  
        blank=True
    )

class motorsession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)  # Lazy reference
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def end_session(self):
        self.end_time = datetime.now()
        self.is_active = False
        self.save()
    def save(self, *args, **kwargs):
        if self.is_active:
            motorsession.objects.filter(user=self.user, is_active=True).update(is_active=False, end_time=datetime.now())
        super().save(*args, **kwargs)
    
    

class protodata(models.Model):
    session = models.ForeignKey(motorsession,on_delete=models.CASCADE,null=True,blank=True)
    actual_position = models.IntegerField()
    actual_velocity = models.IntegerField()
    phase_current = models.IntegerField()
    voltage_logic = models.IntegerField()
    time = models.TimeField(auto_now_add=True)
