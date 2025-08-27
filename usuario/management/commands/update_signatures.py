import os
import base64
import psycopg2
import boto3
import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from solicitacao.models import Assinatura, Funcionario

# É uma boa prática definir as configurações do S3 a partir do settings.py
# para garantir que o Django e o Boto3 usem as mesmas credenciais.
AWS_STORAGE_BUCKET_NAME = settings.AWS_STORAGE_BUCKET_NAME
AWS_S3_REGION_NAME = settings.AWS_S3_REGION_NAME
AWS_ACCESS_KEY_ID = settings.AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY = settings.AWS_SECRET_ACCESS_KEY


class Command(BaseCommand):
    help = 'Busca a assinatura mais recente de cada funcionário no sistema antigo, sobe para o S3 e atualiza os registros antigos no novo sistema.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('--- Iniciando processo de atualização de assinaturas ---'))

        # --- 1. Configuração dos Clientes e Conexões ---
        
        # Configurações de conexão com o banco de dados antigo (lidas do .env)
        old_db_config = {
            'host': os.environ.get('DB_HOST_OLD_SYSTEM'),
            'database': os.environ.get('DB_NAME_OLD_SYSTEM'),
            'user': os.environ.get('DB_USER_OLD_SYSTEM'),
            'password': os.environ.get('DB_PASSWORD_OLD_SYSTEM'),
            'port': os.environ.get('DB_PORT_OLD_SYSTEM', '5432'),
        }

        # Cliente Boto3 para interagir com o S3
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
                region_name=AWS_S3_REGION_NAME
            )
            self.stdout.write(self.style.SUCCESS('Cliente S3 configurado com sucesso.'))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Erro ao configurar o cliente S3: {e}"))
            return

        conn = None
        try:
            # --- 2. Conexão e Consulta ao Banco de Dados Antigo ---
            self.stdout.write('Conectando ao banco de dados antigo...')
            conn = psycopg2.connect(**old_db_config)
            cursor = conn.cursor()
            self.stdout.write(self.style.SUCCESS('Conexão com o banco de dados antigo estabelecida.'))

            # Query para buscar a assinatura mais recente de cada funcionário.
            # A condição JOIN foi atualizada para usar s.id_solicitacao = a.id_solicitacao
            query = """
                WITH ranked_solicitacoes AS (
                    SELECT
                        s.funcionario_recebe,
                        a.assinatura,
                        ROW_NUMBER() OVER(PARTITION BY s.funcionario_recebe ORDER BY s.data_solicitada DESC) as rn
                    FROM
                        sistema_epi.tb_solicitacoes s
                    JOIN
                        sistema_epi.tb_assinatura a ON s.id_solicitacao = a.id_solicitacao
                    WHERE
                        s.funcionario_recebe IS NOT NULL 
                        AND a.assinatura IS NOT NULL 
                        AND a.assinatura LIKE 'data:image/png;base64,%'
                )
                SELECT
                    funcionario_recebe,
                    assinatura
                FROM
                    ranked_solicitacoes
                WHERE
                    rn = 1;
            """
            
            cursor.execute(query)
            assinaturas_unicas = cursor.fetchall()
            self.stdout.write(f"Encontradas {len(assinaturas_unicas)} assinaturas únicas de funcionários.")

            # Data limite para a atualização
            cutoff_date = timezone.make_aware(datetime.datetime(2025, 8, 27, 8, 5, 1, 552000))

            # --- 3. Processamento: Decodificar, Upload para S3 e Atualizar Django ---
            for matricula, base64_assinatura in assinaturas_unicas:
                self.stdout.write(f"\nProcessando matrícula: {matricula}")
                try:
                    # Verifica se o funcionário existe no novo sistema
                    if not Funcionario.objects.filter(matricula=matricula).exists():
                        self.stdout.write(self.style.WARNING(f"  -> Funcionário com matrícula {matricula} não encontrado no novo sistema. Pulando."))
                        continue
                    
                    funcionario = Funcionario.objects.filter(matricula=matricula).first()

                    if isinstance(base64_assinatura, memoryview):
                        base64_assinatura_str = base64_assinatura.tobytes().decode('utf-8')
                    else:
                        base64_assinatura_str = base64_assinatura
                    
                    # Decodifica a imagem Base64
                    header, encoded = base64_assinatura_str.split(",", 1)
                    image_bytes = base64.b64decode(encoded)
                    
                    # Define o caminho do arquivo no S3 (seguindo o padrão do upload_to do ImageField)
                    s3_key = f'assinatura/{funcionario.matricula}.png'
                    
                    # Faz o upload para o S3
                    s3_client.put_object(
                        Bucket=AWS_STORAGE_BUCKET_NAME,
                        Key=s3_key,
                        Body=image_bytes,
                        ContentType='image/png'
                    )
                    self.stdout.write(f"  -> Assinatura enviada para o S3 em: {s3_key}")

                    # Atualiza todos os registros de assinatura antigos para este funcionário no banco de dados do Django
                    # com o novo caminho do S3.
                    num_updated = Assinatura.objects.filter(
                        solicitacao__funcionario__matricula=matricula,
                        data_criacao__lt=cutoff_date
                    ).update(imagem_assinatura=s3_key)
                    
                    if num_updated > 0:
                        self.stdout.write(self.style.SUCCESS(f"  -> {num_updated} registro(s) de assinatura atualizado(s) no novo sistema."))
                    else:
                        self.stdout.write(self.style.NOTICE(f"  -> Nenhum registro de assinatura anterior a {cutoff_date.strftime('%Y-%m-%d')} encontrado para esta matrícula."))

                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"  -> Erro ao processar matrícula {matricula}: {e}"))

        except psycopg2.Error as e:
            self.stderr.write(self.style.ERROR(f"Erro de banco de dados: {e}"))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"Ocorreu um erro inesperado: {e}"))
        finally:
            # --- 4. Finalização e Limpeza ---
            if conn:
                cursor.close()
                conn.close()
                self.stdout.write('\nConexão com o banco de dados antigo foi fechada.')
        
        self.stdout.write(self.style.SUCCESS('\n--- Processo de atualização de assinaturas finalizado ---'))
