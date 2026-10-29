"""Carga inicial dos extintores e hidrantes (planilha do SESMT).

Uso:  python manage.py importar_incendio
Pode ser rodado de novo: atualiza pelo código, sem duplicar.
"""
import re
from datetime import date
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from incendio.models import ComponenteHidrante, Extintor, Hidrante, HistoricoEquipamento

# Nº, localização, nº do cilindro, tipo, capacidade, próxima recarga (MM/AAAA), teste hidrostático
EXTINTORES = [
    (1, 'SALA TREINAMENTO', '69534', 'CO2', '6', '01/2027', 2030),
    (2, 'PORTARIA', '19859', 'ABC', '6', '05/2027', 2028),
    (3, 'AMBULATÓRIO', '20243', 'ABC', '6', '12/2026', 2028),
    (4, 'VESTUÁRIO (PÁTIO)', '31317', 'ABC', '6', '01/2027', 2027),
    (5, 'CENTRAL ULTRA GÁS', '9069', 'BC', '12', '12/2026', 2030),
    (6, 'COZINHA (DENTRO)', '', 'CO2', '6', '12/2026', 2030),
    (7, 'ATRÁS DA COZINHA', '5609', 'ABC', '6', '12/2026', 2028),
    (8, 'REFEITÓRIO 1', '12997', 'CO2', '6', '12/2026', 2026),
    (9, 'REFEITÓRIO 2', '86014', 'ABC', '6', '05/2027', 2031),
    (10, 'OXIGÊNIO LASER (RUA EXTERNA)', '19889', 'ABC', '6', '09/2027', 2029),
    (11, 'SUB ESTAÇÃO (ENTRADA GALPÃO DA FÁBRICA)', '27774', 'CO2', '6', '12/2026', 2030),
    (12, 'CONTABILIDADE / FINANCEIRO (CORREDOR ADMINISTRATIVO - 1º ANDAR)', '13537', 'CO2', '6', '12/2026', 2030),
    (13, 'SALA ARQUIVO RH / DP (CORREDOR ADMINISTRATIVO - 1º ANDAR)', '11630', 'BC', '6', '12/2026', 2030),
    (14, 'CARPINTARIA (PRX SALA ESTOQUE DE FERRAMENTAS)', '61714', 'BC', '6', '05/2027', 2027),
    (15, 'CARPINTARIA (ESTOQUE PNEUS ALMOX)', '31251', 'ABC', '6', '05/2027', 2027),
    (16, 'CARPINTARIA (CORREDOR CENTRAL)', '31541', 'ABC', '6', '07/2027', 2027),
    (17, 'CASA BOMBA INCÊNDIO (ATRÁS DA CARPINTARIA)', '85872', 'ABC', '6', '09/2027', 2031),
    (18, 'PONTO (FÁBRICA)', '13542', 'ABC', '4', '12/2026', 2026),
    (19, 'SALA MANUTENÇÃO/QUALIDADE', '52396', 'CO2', '4', '12/2026', 2030),
    (20, 'MANUTENÇÃO', '34268', 'ABC', '6', '07/2027', 2027),
    (21, 'ALMOXARIFADO (DENTRO)', '56918', 'CO2', '10', '12/2026', 2029),
    (22, 'ALMOX (JANELA ALMOX)', '28125', 'CO2', '4', '12/2026', 2030),
    (23, 'SUB ESTAÇÃO (ENTRADA CEMAG - PORTARIA)', '416', 'CO2', '6', '12/2026', 2026),
    (24, 'MONTAGEM DOS TANQUES (PRX HIDRANTE PORTA DE SAÍDA)', '13646', 'ABC', '4', '12/2026', 2029),
    (25, 'SUB ESTAÇÃO DA FÁBRICA (SETOR SOLDA)', '20322', 'ABC', '6', '12/2026', 2028),
    (26, 'EXPEDIÇÃO', '34276', 'ABC', '6', '12/2026', 2027),
    (27, 'DEPÓSITO DE INFLAMÁVEIS', '1368', 'PQS ABC', '20', '09/2027', 2031),
    (28, 'FORJARIA (PRX BANHEIRO)', '69240', 'CO2', '10', '12/2026', 2030),
    (29, 'ARQUIVO MORTO (RUA EXTERNA)', '34689', 'BC', '6', '12/2026', 2026),
    (30, 'ESTAMPARIA (SAÍDA DE EMERGÊNCIA)', '34177', 'ABC', '6', '07/2027', 2027),
    (31, 'ESTAMPARIA (PRX AO LASER)', '2841', 'ABC', '6', '07/2027', 2030),
    (32, 'BORRACHARIA', '13387', 'ABC', '4', '12/2026', 2028),
    (33, 'FORJARIA INT. TANQUE', '34025', 'ABC', '6', '04/2027', 2027),
    (34, 'PLAT. TANQUE E CAÇAMBA', '26920', 'CO2', '6', '12/2026', 2026),
    (35, 'ROBÔ', '64555', 'ABC', '6', '05/2027', 2030),
    (36, 'RUA EXTERNA (PRX A SALA DE COMPRESSOR)', '85852', 'ABC', '6', '04/2027', 2030),
    (37, 'USINAGEM (PRX BOBINAS)', '281689', 'CO2', '6', '07/2027', 2030),
    (38, 'CABINE DE SECAGEM', '1812', 'ABC', '6', '12/2026', 2030),
    (39, 'SERRALHERIA', '20445', 'ABC', '6', '12/2026', 2028),
    (40, 'CARPINTARIA (ATRÁS PINTURA)', '6142', 'ABC', '6', '10/2026', 2026),
    (41, 'FRENTE FORJARIA', '31496', 'ABC', '6', '04/2027', 2027),
    (42, 'FRENTE REFEITÓRIO', '31228', 'ABC', '6', '12/2026', 2027),
]

# Código, localização, [(componente, quantidade)]. Quantidade None = item só de verificação.
# H7 tem "00 chave" na planilha: entra sem chave prevista.
HIDRANTES = [
    ('H1', 'PÁTIO DA ENTRADA', [('Mangueira 15m', 2), ('Esguicho', 3), ('Chave', 1)]),
    ('H2', 'CARPINTARIA', [('Mangueira 15m', 2), ('Esguicho', 1), ('Chave', 1)]),
    ('H3', 'CARPINTARIA', [('Mangueira 15m', 2), ('Esguicho', 1), ('Chave', 1)]),
    ('H4', 'MANUTENÇÃO', [('Mangueira 15m', 1), ('Esguicho', 1), ('Chave', 1)]),
    ('H5', 'ALMOXARIFADO', [('Mangueira 15m', 1), ('Esguicho', 1), ('Chave', 1)]),
    ('H6', 'SOLDA (COLUNA CENTRAL)', [('Mangueira 15m', 1), ('Esguicho', 2), ('Chave', 1)]),
    ('H7', 'SOLDA (SAÍDA FUNDOS FÁBRICA)', [('Mangueira 15m', 3), ('Esguicho', 2)]),
    ('HR', 'HIDRANTE DE RECALQUE', [('Caixa', None), ('Brita', None), ('Lubrificação', None)]),
]

AGENTES = {'ABC': 'PQS ABC', 'BC': 'PQS BC', 'PQS ABC': 'PQS ABC', 'CO2': 'CO2'}


def _limpar(texto):
    return re.sub(r'\s+', ' ', texto).strip()


class Command(BaseCommand):
    help = 'Importa os extintores e hidrantes da planilha do SESMT (atualiza pelo código, sem duplicar).'

    @transaction.atomic
    def handle(self, *args, **options):
        criados = atualizados = 0

        for numero, local, cilindro, agente, capacidade, recarga, teste in EXTINTORES:
            mes, ano = recarga.split('/')
            extintor, criado = Extintor.objects.update_or_create(
                codigo=f'EXT-{numero:02d}',
                defaults={
                    'localizacao': _limpar(local),
                    'numero_cilindro': cilindro or None,
                    'agente': AGENTES[agente],
                    'capacidade_kg': Decimal(capacidade),
                    'proxima_recarga': date(int(ano), int(mes), 1),
                    'teste_hidrostatico_ano': teste,
                },
            )
            if criado:
                criados += 1
                HistoricoEquipamento.objects.create(
                    extintor=extintor, acao='criado', descricao='Cadastrado pela importação da planilha'
                )
            else:
                atualizados += 1

        for codigo, local, componentes in HIDRANTES:
            hidrante, criado = Hidrante.objects.update_or_create(
                codigo=codigo, defaults={'localizacao': _limpar(local)}
            )
            # Componentes só na criação: depois eles são mantidos pela tela de cadastro
            if criado:
                for ordem, (nome, quantidade) in enumerate(componentes):
                    ComponenteHidrante.objects.create(hidrante=hidrante, nome=nome, quantidade=quantidade, ordem=ordem)
                criados += 1
                HistoricoEquipamento.objects.create(
                    hidrante=hidrante, acao='criado',
                    descricao=f'Cadastrado pela importação da planilha: {hidrante.descricao_componentes()}',
                )
            else:
                atualizados += 1

        self.stdout.write(self.style.SUCCESS(f'{criados} equipamento(s) criado(s), {atualizados} atualizado(s).'))
