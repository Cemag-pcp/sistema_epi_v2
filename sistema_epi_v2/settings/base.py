from pathlib import Path
import os
import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = env('SECRET_KEY')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'core',
    'checklist',
    'devolucao',
    'usuario',
    'equipamento',
    'padrao',
    'solicitacao',
    'ficha',
    'storages',  # ✅ App do Django Storages
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'sistema_epi_v2.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'sistema_epi_v2.wsgi.application'

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

AUTH_USER_MODEL = 'usuario.Usuario'

# =============================================================================
# CONFIGURAÇÕES AWS S3 (SEMPRE ATIVAS - DEV E PROD)
# =============================================================================

AWS_ACCESS_KEY_ID = env('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = env('AWS_SECRET_ACCESS_KEY')
AWS_STORAGE_BUCKET_NAME = env('AWS_STORAGE_BUCKET_NAME')
AWS_S3_REGION_NAME = env('AWS_S3_REGION_NAME')
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'

# ⚠️ FORÇAR S3 SEMPRE - EM TODOS OS AMBIENTES
MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# =============================================================================
# CONFIGURAÇÕES DE AUTENTICAÇÃO
# =============================================================================

LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/login/'

# =============================================================================
# ARQUIVOS ESTÁTICOS (CSS, JavaScript, Images)
# =============================================================================

STATIC_URL = '/static/'
STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static/'),
    os.path.join(BASE_DIR, 'core/static'),
    os.path.join(BASE_DIR, 'checklist/static'),
    os.path.join(BASE_DIR, 'devolucao/static'),
    os.path.join(BASE_DIR, 'equipamento/static'),
    os.path.join(BASE_DIR, 'ficha/static'),
    os.path.join(BASE_DIR, 'padrao/static'),
    os.path.join(BASE_DIR, 'solicitacao/static'),
    os.path.join(BASE_DIR, 'usuario/static'),
]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

