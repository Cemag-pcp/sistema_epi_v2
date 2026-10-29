import calendar
import uuid
from datetime import date

from django.conf import settings
from django.db import models
from django.utils import timezone
from storages.backends.s3boto3 import S3Boto3Storage


# Resposta de cada item dos checklists de extintor e hidrante
RESULTADO_CHOICES = [
    ('ok', 'OK'),
    ('nok', 'NOK'),
    ('na', 'N/A'),
]

STATUS_INSPECAO_CHOICES = [
    ('aprovado', 'Aprovado'),
    ('reprovado', 'Reprovado'),
    # Todos os itens marcados como N/A: não dá para dizer que o equipamento foi aprovado
    ('nao_avaliado', 'Não avaliado'),
]


def calcular_status(resultados):
    """Reprovado se algum item for NOK; N/A não aprova nem reprova."""
    resultados = list(resultados)
    if 'nok' in resultados:
        return 'reprovado'
    if 'ok' in resultados:
        return 'aprovado'
    return 'nao_avaliado'


def foto_inspecao_upload_path(instance, filename):
    if instance.inspecao_extintor_id:
        return f'incendio/extintor/inspecao_{instance.inspecao_extintor_id}/{filename}'
    return f'incendio/hidrante/inspecao_{instance.inspecao_hidrante_id}/{filename}'


class Extintor(models.Model):
    AGENTE_CHOICES = [
        ('CO2', 'CO2'),
        ('PQS ABC', 'PQS ABC'),
        ('PQS BC', 'PQS BC'),
        ('AP', 'Água pressurizada'),
        ('EM', 'Espuma mecânica'),
    ]

    # O código identifica o posto (parede/suporte), onde o QR Code fica colado.
    # Quando o cilindro é trocado na recarga, só o número do cilindro muda.
    codigo = models.CharField(max_length=20, unique=True)
    localizacao = models.CharField(max_length=255)
    numero_cilindro = models.CharField(max_length=50, blank=True, null=True)
    agente = models.CharField(max_length=10, choices=AGENTE_CHOICES)
    capacidade_kg = models.DecimalField(max_digits=5, decimal_places=1)
    # Guardamos sempre o dia 1 do mês: a validade vale até o fim desse mês
    proxima_recarga = models.DateField(null=True, blank=True)
    teste_hidrostatico_ano = models.PositiveIntegerField(null=True, blank=True)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['codigo']

    def __str__(self):
        return f'{self.codigo} - {self.localizacao}'

    @property
    def recarga_vencida(self):
        if not self.proxima_recarga:
            return False
        ultimo_dia = calendar.monthrange(self.proxima_recarga.year, self.proxima_recarga.month)[1]
        return timezone.localdate() > self.proxima_recarga.replace(day=ultimo_dia)

    @property
    def teste_hidrostatico_vencido(self):
        if not self.teste_hidrostatico_ano:
            return False
        return timezone.localdate().year > self.teste_hidrostatico_ano

    def situacao_sugerida(self):
        """Sugestão para o item "Situação (validade)" da inspeção, calculada pelas datas."""
        if not self.proxima_recarga and not self.teste_hidrostatico_ano:
            return 'na'
        if self.recarga_vencida or self.teste_hidrostatico_vencido:
            return 'nok'
        return 'ok'

    def vence_em_dias(self, dias=30):
        """True se a recarga vence nos próximos `dias` dias (e ainda não venceu)."""
        if not self.proxima_recarga or self.recarga_vencida:
            return False
        ultimo_dia = calendar.monthrange(self.proxima_recarga.year, self.proxima_recarga.month)[1]
        fim_validade = self.proxima_recarga.replace(day=ultimo_dia)
        return (fim_validade - timezone.localdate()).days <= dias


class Hidrante(models.Model):
    codigo = models.CharField(max_length=20, unique=True)
    localizacao = models.CharField(max_length=255)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    ativo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['codigo']

    def __str__(self):
        return f'{self.codigo} - {self.localizacao}'

    def descricao_componentes(self):
        partes = []
        for componente in self.componentes.all():
            if componente.quantidade is None:
                partes.append(componente.nome)
            else:
                partes.append(f'{componente.quantidade:02d} {componente.nome}')
        return ', '.join(partes)


class ComponenteHidrante(models.Model):
    hidrante = models.ForeignKey(Hidrante, on_delete=models.CASCADE, related_name='componentes')
    nome = models.CharField(max_length=100)
    # Vazio = item só de verificação (ex.: "Lubrificação"), sem contagem
    quantidade = models.PositiveIntegerField(null=True, blank=True)
    ordem = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['ordem', 'id']

    def __str__(self):
        return f'{self.hidrante.codigo} - {self.nome}'


class InspecaoExtintor(models.Model):
    """Inspeção do RQ ST-001-001. Os dados do extintor são copiados no momento da inspeção
    para que editar o cadastro depois não altere o histórico."""

    extintor = models.ForeignKey(Extintor, on_delete=models.PROTECT, related_name='inspecoes')
    inspetor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='inspecoes_extintor',
    )
    data_inspecao = models.DateTimeField(default=timezone.now)

    situacao = models.CharField('Situação (validade)', max_length=3, choices=RESULTADO_CHOICES)
    estado = models.CharField(max_length=3, choices=RESULTADO_CHOICES)
    manometro = models.CharField('Manômetro', max_length=3, choices=RESULTADO_CHOICES)
    lacre = models.CharField('Lacre íntegro', max_length=3, choices=RESULTADO_CHOICES)
    status = models.CharField(max_length=15, choices=STATUS_INSPECAO_CHOICES)
    observacao = models.TextField(blank=True, null=True)

    codigo_historico = models.CharField(max_length=20)
    localizacao_historico = models.CharField(max_length=255)
    numero_cilindro_historico = models.CharField(max_length=50, blank=True, null=True)
    agente_historico = models.CharField(max_length=10)
    capacidade_kg_historico = models.DecimalField(max_digits=5, decimal_places=1)
    proxima_recarga_historico = models.DateField(null=True, blank=True)
    teste_hidrostatico_ano_historico = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    ITENS = ['situacao', 'estado', 'manometro', 'lacre']

    class Meta:
        ordering = ['-data_inspecao']

    def __str__(self):
        return f'{self.codigo_historico} - {self.data_inspecao:%d/%m/%Y}'

    def copiar_dados_extintor(self):
        e = self.extintor
        self.codigo_historico = e.codigo
        self.localizacao_historico = e.localizacao
        self.numero_cilindro_historico = e.numero_cilindro
        self.agente_historico = e.agente
        self.capacidade_kg_historico = e.capacidade_kg
        self.proxima_recarga_historico = e.proxima_recarga
        self.teste_hidrostatico_ano_historico = e.teste_hidrostatico_ano

    def atualizar_status(self):
        self.status = calcular_status(getattr(self, item) for item in self.ITENS)


class InspecaoHidrante(models.Model):
    hidrante = models.ForeignKey(Hidrante, on_delete=models.PROTECT, related_name='inspecoes')
    inspetor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='inspecoes_hidrante',
    )
    data_inspecao = models.DateTimeField(default=timezone.now)

    funcionamento = models.CharField(
        'Equipamento funciona perfeitamente', max_length=3, choices=RESULTADO_CHOICES
    )
    # Preenchidos automaticamente a partir dos componentes
    falta_equipamento = models.BooleanField(default=False)
    falta_descricao = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=15, choices=STATUS_INSPECAO_CHOICES)
    observacao = models.TextField(blank=True, null=True)

    codigo_historico = models.CharField(max_length=20)
    localizacao_historico = models.CharField(max_length=255)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_inspecao']

    def __str__(self):
        return f'{self.codigo_historico} - {self.data_inspecao:%d/%m/%Y}'

    def atualizar_resumo(self):
        """Recalcula status e "Falta equipamento? / Qual?" a partir dos itens já salvos."""
        itens = list(self.itens.all())
        faltando = []
        for item in itens:
            if item.resultado == 'na':
                continue
            if item.quantidade_prevista is not None and item.quantidade_encontrada is not None \
                    and item.quantidade_encontrada < item.quantidade_prevista:
                faltando.append(
                    f'{item.nome}: previsto {item.quantidade_prevista}, encontrado {item.quantidade_encontrada}'
                )
        self.falta_equipamento = bool(faltando)
        self.falta_descricao = '; '.join(faltando) or None
        self.status = calcular_status([self.funcionamento] + [i.resultado for i in itens])


class ItemInspecaoHidrante(models.Model):
    inspecao = models.ForeignKey(InspecaoHidrante, on_delete=models.CASCADE, related_name='itens')
    componente = models.ForeignKey(
        ComponenteHidrante, on_delete=models.SET_NULL, null=True, blank=True, related_name='itens_inspecao'
    )
    nome = models.CharField(max_length=100)
    quantidade_prevista = models.PositiveIntegerField(null=True, blank=True)
    quantidade_encontrada = models.PositiveIntegerField(null=True, blank=True)
    resultado = models.CharField(max_length=3, choices=RESULTADO_CHOICES)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.nome} - {self.get_resultado_display()}'


class FotoInspecao(models.Model):
    inspecao_extintor = models.ForeignKey(
        InspecaoExtintor, on_delete=models.CASCADE, null=True, blank=True, related_name='fotos'
    )
    inspecao_hidrante = models.ForeignKey(
        InspecaoHidrante, on_delete=models.CASCADE, null=True, blank=True, related_name='fotos'
    )
    foto = models.ImageField(upload_to=foto_inspecao_upload_path, storage=S3Boto3Storage())
    descricao = models.CharField(max_length=255, blank=True, null=True)
    data_upload = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['data_upload']
        verbose_name = 'Foto da inspeção'
        verbose_name_plural = 'Fotos das inspeções'

    def __str__(self):
        return self.descricao or self.foto.name


class HistoricoEquipamento(models.Model):
    """Linha do tempo de cada extintor/hidrante (cadastro, edições, inspeções...)."""

    ACAO_CHOICES = [
        ('criado', 'Cadastrado'),
        ('editado', 'Editado'),
        ('ativado', 'Ativado'),
        ('desativado', 'Desativado'),
        ('inspecionado', 'Inspecionado'),
        ('inspecao_editada', 'Inspeção editada'),
        ('inspecao_excluida', 'Inspeção excluída'),
    ]

    extintor = models.ForeignKey(
        Extintor, on_delete=models.CASCADE, null=True, blank=True, related_name='historico'
    )
    hidrante = models.ForeignKey(
        Hidrante, on_delete=models.CASCADE, null=True, blank=True, related_name='historico'
    )
    acao = models.CharField(max_length=20, choices=ACAO_CHOICES)
    descricao = models.TextField(blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='historico_equipamentos_incendio',
    )
    data = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data', '-id']

    def __str__(self):
        alvo = self.extintor or self.hidrante
        return f'{alvo} - {self.get_acao_display()}'


def primeiro_dia_mes(valor):
    """Converte 'AAAA-MM', 'MM/AAAA' ou date para o dia 1 do mês. Vazio vira None."""
    if not valor:
        return None
    if isinstance(valor, date):
        return valor.replace(day=1)
    valor = str(valor).strip()
    if '/' in valor:
        mes, ano = valor.split('/')
    else:
        ano, mes = valor.split('-')[:2]
    return date(int(ano), int(mes), 1)
