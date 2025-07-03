import psycopg2
from django.core.management.base import BaseCommand
from usuario.models import Setor, Funcionario, Cargo
import os

class Command(BaseCommand):
    help = 'Migra dados de funcionários e setores do CEMAG Academy para os models locais'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Iniciando migração de dados do CEMAG Academy...'))
        
        # Configurações de conexão com o PostgreSQL do CEMAG Academy
        db_config = {
            'host': os.environ.get('DB_HOST_CEMAG_ACADEMY'),
            'database': os.environ.get('DB_NAME'),  # Certifique-se de que esta variável está no .env
            'user': os.environ.get('DB_USER'),
            'password': os.environ.get('DB_PASSWORD'),
            'port': os.environ.get('DB_PORT', '5432'),
        }
        
        try:
            # Estabelecer conexão diretamente com psycopg2
            conn = psycopg2.connect(**db_config)
            cursor = conn.cursor()
            
            # Query para obter funcionários não excluídos com seus setores
            cursor.execute("""
                SELECT cf.matricula, cf.nome, cs.nome, cf.excluido
                FROM cemag_academy.cadastros_funcionario cf
                JOIN cemag_academy.cadastros_setor cs ON cf.setor_id = cs.id 
                WHERE cf.excluido = False
                ORDER BY cf.id DESC
            """)
            
            funcionarios = cursor.fetchall()
            
            # Contadores para relatório
            setores_criados = 0
            funcionarios_criados = 0
            funcionarios_atualizados = 0
            
            for matricula, nome_funcionario, nome_setor, excluido in funcionarios:
                try:
                    # Verificar/Criar Setor
                    setor, created = Setor.objects.get_or_create(nome=nome_setor)
                    if created:
                        setores_criados += 1
                        self.stdout.write(self.style.SUCCESS(f'Setor criado: {nome_setor}'))
                    
                    # Verificar/Criar Funcionário
                    defaults = {
                        'nome': nome_funcionario,
                        'setor': setor,
                        'ativo': not excluido,
                        'tipo_acesso': 'operador',
                        'data_admissao': None
                    }
                    
                    # Tentar obter um cargo padrão
                    cargo_padrao = Cargo.objects.first()
                    if cargo_padrao:
                        defaults['cargo'] = cargo_padrao
                    
                    funcionario, created = Funcionario.objects.update_or_create(
                        matricula=matricula,
                        defaults=defaults
                    )
                    
                    if created:
                        funcionarios_criados += 1
                        self.stdout.write(self.style.SUCCESS(f'Funcionário criado: {nome_funcionario} (Matrícula: {matricula})'))
                    else:
                        funcionarios_atualizados += 1
                        self.stdout.write(self.style.WARNING(f'Funcionário atualizado: {nome_funcionario} (Matrícula: {matricula})'))
                
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f'Erro ao processar funcionário {nome_funcionario}: {str(e)}'))
                    continue
            
            self.stdout.write(self.style.SUCCESS('\nMigração concluída com sucesso!'))
            self.stdout.write(self.style.SUCCESS(f'Total de setores criados: {setores_criados}'))
            self.stdout.write(self.style.SUCCESS(f'Total de funcionários criados: {funcionarios_criados}'))
            self.stdout.write(self.style.SUCCESS(f'Total de funcionários atualizados: {funcionarios_atualizados}'))
        
        except psycopg2.Error as e:
            self.stdout.write(self.style.ERROR(f'Erro de conexão com o banco de dados: {str(e)}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Erro durante a migração: {str(e)}'))
        finally:
            if 'cursor' in locals():
                cursor.close()
            if 'conn' in locals():
                conn.close()