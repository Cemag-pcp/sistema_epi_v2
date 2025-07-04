import psycopg2
from django.core.management.base import BaseCommand
from equipamento.models import Equipamento
from solicitacao.models import Solicitacao, DadosSolicitacao
from usuario.models import Funcionario, Usuario

from django.utils import timezone
import os

class Command(BaseCommand):
    help = 'Importa solicitações do sistema antigo para o novo sistema'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Iniciando importação de solicitações...'))
        
        # Configurações de conexão com o sistema antigo
        old_db_config = {
            'host': os.environ.get('DB_HOST_OLD_SYSTEM'),
            'database': os.environ.get('DB_NAME_OLD_SYSTEM'),
            'user': os.environ.get('DB_USER_OLD_SYSTEM'),
            'password': os.environ.get('DB_PASSWORD_OLD_SYSTEM'),
            'port': os.environ.get('DB_PORT_OLD_SYSTEM', '5432'),
        }
        
        try:
            # Estabelecer conexão com o sistema antigo
            conn = psycopg2.connect(**old_db_config)
            cursor = conn.cursor()
            
            # Query para obter as últimas solicitações por funcionário e item
            cursor.execute("""
                SELECT s1.id, s1.codigo_item, s1.quantidade, s1.motivo, 
                       s1.funcionario_recebe, s1.data_solicitada
                FROM sistema_epi.tb_solicitacoes s1
                INNER JOIN (
                    SELECT funcionario_recebe, codigo_item, MAX(id) as ultimo_id
                    FROM sistema_epi.tb_solicitacoes
                    GROUP BY funcionario_recebe, codigo_item
                ) s2 ON s1.id = s2.ultimo_id
                ORDER BY s1.funcionario_recebe, s1.id DESC;
            """)
            
            solicitacoes = cursor.fetchall()
            
            # Contadores para relatório
            print(solicitacoes)
            solicitacoes_criadas = 0
            itens_criados = 0
            solicitacoes_ignoradas = 0
            
            for (old_id, codigo_item, quantidade, motivo_antigo, 
                 matricula_funcionario, data_solicitada) in solicitacoes:
                
                try:
                    # Verificar se o funcionário existe no novo sistema
                    funcionario = Funcionario.objects.get(matricula=matricula_funcionario)
                    
                    codigo_tratado = codigo_item.split(' - ')[0]
                    # Verificar se o equipamento existe no novo sistema
                    equipamento = Equipamento.objects.get(codigo=codigo_tratado)
                    
                    # Criar a solicitação (usando o primeiro usuário master como solicitante)
                    usuario_solicitante = Usuario.objects.filter(
                        funcionario__tipo_acesso='master'
                    ).first()
                    
                    if not usuario_solicitante:
                        self.stdout.write(self.style.ERROR('Nenhum usuário master encontrado!'))
                        return
                    
                    # Mapear motivos antigos para os novos
                    motivo_map = {
                        'primeira_entrega': 'primeira entrega',
                        'substituicao': 'substituicao',
                        'perda': 'perda',
                        'dano': 'dano',
                        # Adicione outros mapeamentos conforme necessário
                    }
                    
                    motivo_novo = motivo_map.get(motivo_antigo.lower(), 'substituicao')
                    
                    # Criar solicitação
                    solicitacao = Solicitacao.objects.create(
                        solicitante=usuario_solicitante,
                        funcionario=funcionario,
                        data_solicitacao=data_solicitada or timezone.now(),
                        status='Entregue',  # Considerando que são solicitações antigas já entregues
                        observacoes=f"Importado do sistema antigo (ID: {old_id})"
                    )
                    
                    # Criar dados da solicitação
                    DadosSolicitacao.objects.create(
                        solicitacao=solicitacao,
                        equipamento=equipamento,
                        quantidade=quantidade,
                        motivo=motivo_novo,
                        observacoes=f"Importado do sistema antigo (ID: {old_id})"
                    )
                    
                    solicitacoes_criadas += 1
                    itens_criados += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Solicitação importada: Funcionário {funcionario.nome}, "
                            f"Equipamento {equipamento.nome}"
                        )
                    )
                
                except Funcionario.DoesNotExist:
                    solicitacoes_ignoradas += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"Solicitação ignorada: Funcionário com matrícula {matricula_funcionario} "
                            f"não encontrado no novo sistema"
                        )
                    )
                    continue
                
                except Equipamento.DoesNotExist:
                    solicitacoes_ignoradas += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"Solicitação ignorada: Equipamento com código {codigo_tratado} "
                            f"não encontrado no novo sistema"
                        )
                    )
                    continue
                
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f"Erro ao importar solicitação ID {old_id}: {str(e)}"
                        )
                    )
                    continue
            
            self.stdout.write(self.style.SUCCESS('\nImportação concluída com sucesso!'))
            self.stdout.write(self.style.SUCCESS(f'Total de solicitações criadas: {solicitacoes_criadas}'))
            self.stdout.write(self.style.SUCCESS(f'Total de itens de solicitação criados: {itens_criados}'))
            self.stdout.write(self.style.WARNING(f'Total de solicitações ignoradas: {solicitacoes_ignoradas}'))
        
        except psycopg2.Error as e:
            self.stdout.write(self.style.ERROR(f'Erro de conexão com o banco de dados: {str(e)}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Erro durante a importação: {str(e)}'))
        finally:
            if 'cursor' in locals():
                cursor.close()
            if 'conn' in locals():
                conn.close()