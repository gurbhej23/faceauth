from django.db import models
from mongoengine import Document
from mongoengine.fields import *
from datetime import datetime


class User(Document):
    username = StringField(required=True, unique=True)
    email= EmailField(required=True, unique=True)
    password= StringField(required=True)
    face_encoding = ListField(FloatField())
    created_at = DateTimeField(default=datetime.utcnow)
    
    
