import json
from django.core.management.base import BaseCommand
from equipamento.models import Equipamento

class Command(BaseCommand):
    help = 'Importa dados de EPIs de um arquivo JSON para a tabela equipamento_equipamento com verificação de código único'

    def add_arguments(self, parser):
        parser.add_argument('json_file', type=str, help='Caminho para o arquivo JSON de origem')

    def handle(self, *args, **options):
        json_file_path = options['json_file']
        
        try:
            with open(json_file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                
                imported_count = 0
                skipped_count = 0
                skipped_items = []
                
                for item in data['tb_itens']:
                    # Verifica se o código já existe
                    if Equipamento.objects.filter(codigo=item['codigo']).exists():
                        skipped_count += 1
                        skipped_items.append(item['codigo'])
                        continue
                    
                    # Cria o novo equipamento
                    try:
                        equipamento = Equipamento(
                            nome=item['descricao'],
                            codigo=item['codigo'],
                            ativo=True,
                            vida_util_dias=item['vida_util']
                        )
                        equipamento.save()
                        imported_count += 1
                    except Exception as e:
                        skipped_count += 1
                        skipped_items.append(f"{item['codigo']} (erro: {str(e)})")
                
                # Exibe os resultados
                self.stdout.write(self.style.SUCCESS(f'\nResumo da importação:'))
                self.stdout.write(self.style.SUCCESS(f'- Itens importados com sucesso: {imported_count}'))
                self.stdout.write(self.style.WARNING(f'- Itens ignorados: {skipped_count}'))
                
                if skipped_count > 0:
                    self.stdout.write('\nItens ignorados (códigos duplicados ou com erro):')
                    for item in skipped_items:
                        self.stdout.write(f'  - {item}')
                
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR('Arquivo não encontrado.'))
        except json.JSONDecodeError:
            self.stdout.write(self.style.ERROR('Erro ao decodificar o JSON.'))
        except KeyError as e:
            self.stdout.write(self.style.ERROR(f'Campo obrigatório faltando no JSON: {str(e)}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Erro inesperado: {str(e)}'))