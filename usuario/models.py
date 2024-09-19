from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

class TipoUsuario(models.Model):
    
    TIPO_USUARIO_CHOICES = (
        ('lider', 'Lider'),
        ('adm', 'Administrador'),
    )
    
    nome = models.CharField(max_length=20, choices=TIPO_USUARIO_CHOICES, blank=False)

    def __str__(self):
        return self.get_nome_display()  # Para mostrar o nome legível do tipo de usuário

class UsuarioManager(BaseUserManager):
    def create_user(self, matricula, password=None, **extra_fields):
        if not matricula:
            raise ValueError('A matrícula é obrigatória')
        user = self.model(matricula=matricula, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, matricula, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        return self.create_user(matricula, password, **extra_fields)

class Usuario(AbstractBaseUser, PermissionsMixin):
    matricula = models.CharField(max_length=10, unique=True)
    nome = models.CharField(max_length=255)
    email = models.EmailField(max_length=255, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    tipo_usuario = models.ForeignKey(TipoUsuario, on_delete=models.SET_NULL, null=True)

    objects = UsuarioManager()

    USERNAME_FIELD = 'matricula'
    REQUIRED_FIELDS = ['nome']

    def __str__(self):
        return self.nome
