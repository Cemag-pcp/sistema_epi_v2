from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils.translation import gettext_lazy as _


class UsuarioManager(BaseUserManager):
    def create_user(self, matricula, password=None, **extra_fields):
        if not matricula:
            raise ValueError(_('The Matricula field must be set'))
        user = self.model(matricula=matricula, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, matricula, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(matricula, password, **extra_fields)

class Setor(models.Model):
    nome = models.CharField(max_length=150)
    responsavel = models.OneToOneField('Funcionario', on_delete=models.SET_NULL, null=True, blank=True, related_name='responsavel')

    def save(self, *args, **kwargs):
        if self.responsavel and not hasattr(self.responsavel, 'funcionario'):
            # Verifica se o funcionário não tem um usuário associado
            raise ValueError("O responsável pelo setor deve ser um usuário do sistema")
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.nome}'
    
class Funcionario(models.Model):
    TYPE_CHOICES = (
        ('master', 'Master'),
        ('solicitante', 'Solicitante'),
        ('operador', 'Operador'),
    )

    nome = models.CharField(max_length=150)
    matricula = models.IntegerField(unique=True)
    setor = models.ForeignKey(Setor, on_delete=models.CASCADE, related_name='setor_funcionario')
    tipo_acesso = models.CharField(max_length=20, choices=TYPE_CHOICES, default='operador')
    cargo = models.CharField(max_length=150)
    data_admissao = models.DateField(null=True)
    ativo = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.matricula} - {self.nome}'

class Usuario(AbstractBaseUser, PermissionsMixin):
    nome = models.CharField(max_length=150)
    matricula = models.IntegerField(unique=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_atualizacao = models.DateTimeField(auto_now=True)
    funcionario = models.OneToOneField(Funcionario, on_delete=models.SET_NULL, related_name='funcionario' ,null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    
    USERNAME_FIELD = 'matricula'
    REQUIRED_FIELDS = []

    objects = UsuarioManager()

    def __str__(self):
        return f'{self.matricula} - {self.nome}'
    


    