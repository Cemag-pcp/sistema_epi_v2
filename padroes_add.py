import pandas as pd
import os
import django
import traceback
from django.db import transaction

# Configuração do Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sistema_epi_v2.settings")  
django.setup()

# Importação dos modelos
from padrao.models import Padrao, PadraoFuncionario, PadraoEquipamento
from usuario.models import Funcionario, Setor
from equipamento.models import Equipamento

# Leitura do CSV
print("[INFO] Lendo arquivo CSV...")
df = pd.read_csv('padrao_solicitacao_antigo.csv', sep=';', encoding='utf-8')

# Substituir NaN por string vazia para evitar erros
print("[INFO] Substituindo valores NaN por strings vazias...")
df = df.fillna('')

print("[INFO] Colunas disponíveis no CSV:", df.columns)

cont = 0
contagem_setores_diferentes = 0
for _, row in df.iterrows():

    # Ignorar linhas de teste
    if 'teste' in row['nome'].lower():
        print(f"[INFO] Linha ignorada (teste): {row['nome']}")
        continue

    # Extração dos dados da linha
    matricula_solicitante = row['matricula_solicitante']
    nome_padrao = row['nome']
    cod_nome_equipamento = row['codigo_item']
    quantidade_item = row['quantidade']
    motivo = row['motivo']
    obs = row['observacao']
    funcionario_que_recebe = row['funcionario_recebe']

    cont += 1

    try:
        with transaction.atomic():

            # Log de itens específicos
            # if cont in [117, 118, 119, 120, 121, 122, 123, 124, 125]:
            #     print(f"[DEBUG] Processando linha {cont}:")
            #     print(f"        Nome Padrão: {nome_padrao}")
            #     print(f"        Código/Equipamento: {cod_nome_equipamento}")
            #     print(f"        Quantidade: {quantidade_item}")
            #     print(f"        Motivo: {motivo}")
            #     print(f"        Observações: {obs}")
            #     print(f"        Funcionário que recebe: {funcionario_que_recebe}")

            # ------------------------------
            # 🔽 ETAPA 1 - Buscar Funcionário Solicitante
            matricula_solicitante_int = int(matricula_solicitante)
            funcionario_solicitante = Funcionario.objects.get(matricula=matricula_solicitante_int)
            print(f"[INFO] Funcionário solicitante encontrado: {funcionario_solicitante.nome} "
                  f"(Matrícula: {funcionario_solicitante.matricula}, "
                  f"Setor: {funcionario_solicitante.setor.nome})")

            padrao, created = Padrao.objects.get_or_create(
                nome=nome_padrao,
                setor_id=funcionario_solicitante.setor.id,
            )
            print(f"[INFO] Padrão {'criado' if created else 'encontrado'}: {padrao.nome}")

            # ------------------------------
            # 🔽 ETAPA 2 - Buscar Funcionário que recebe
            matricula_funcionario_recebe_int = int(funcionario_que_recebe.split('-')[0])
            funcionario_recebe = Funcionario.objects.get(matricula=matricula_funcionario_recebe_int)

            if funcionario_recebe.setor != funcionario_solicitante.setor:
                contagem_setores_diferentes += 1
                print(f"[WARNING] Alerta de setor diferente! "
                      f"Solicitante: {funcionario_solicitante.setor.nome}, "
                      f"Recebe: {funcionario_recebe.setor.nome}")
                if created:
                    padrao.delete()
                continue # Pula essa linha para evitar inconsistências
            print(f"[INFO] Funcionário que recebe encontrado: {funcionario_recebe.nome}")

            padrao_func, created = PadraoFuncionario.objects.get_or_create(
                padrao_id=padrao.id,
                funcionario_id=funcionario_recebe.id,
            )
            print(f"[INFO] Relacionamento Padrão-Funcionário {'criado' if created else 'encontrado'}")

            # ------------------------------
            # 🔽 ETAPA 3 - Buscar Equipamento
            codigo_equipamento = cod_nome_equipamento.split('-')[0].strip()
            equipamento = Equipamento.objects.get(codigo=codigo_equipamento)
            print(f"[INFO] Equipamento encontrado: {equipamento.nome} (Código: {equipamento.codigo})")

            PadraoEquipamento.objects.get_or_create(
                padrao_funcionario_id=padrao_func.id,
                equipamento_id=equipamento.id,
                quantidade=int(quantidade_item),
                observacoes=obs,
                motivo=motivo
            )
            print("[INFO] Equipamento associado ao funcionário com sucesso.")

    except Exception as e:
        print(f"[ERROR] Erro na linha {cont}: {e}")
        traceback.print_exc()

print(f"[INFO] Processamento finalizado. Total de linhas processadas: {cont}. Setor diferente em {contagem_setores_diferentes} casos.")
