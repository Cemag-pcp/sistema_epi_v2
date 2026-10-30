# dev.py - SIMPLIFICADO
from .base import *
import sys

# Configurações específicas de desenvolvimento
DEBUG = env.bool('DEBUG', default=True)
ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'django-app','sistema-epi-v2-testes.onrender.com']
CSRF_TRUSTED_ORIGINS = [
    'http://127.0.0.1', 'https://sistema-epi-v2-testes.onrender.com'
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST'),
        'PORT': env('DB_PORT'),
        'OPTIONS': {
            'options': '-c search_path='+env('BASE_PROD'),
        },
    }
}

if 'test' in sys.argv:
    DATABASES['default'] = {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
        'TEST': {
            'NAME': ':memory:',
        }
    }
