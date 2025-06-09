import json
from django.test import TestCase, RequestFactory
from django.http import JsonResponse
from .models import Padrao, PadraoFuncionario, PadraoEquipamento
from equipamento.models import Equipamento
from usuario.models import Setor, Funcionario, Usuario
from .views import alter_padrao

class AlterPadraoTestCase(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        
        # Criar usuários
        self.superuser = Usuario.objects.create_superuser(
            nome='admin', matricula='1234', password='admin123'
        )
        self.normal_user = Usuario.objects.create_user(
            nome='user', matricula='4321',  password='user123'
        )
        
        # Criar setor
        self.setor = Setor.objects.create(nome='TI', responsavel=1)
        
        # Criar funcionários
        self.funcionario_super = Funcionario.objects.create(
            user=self.superuser, nome='Admin', matricula='123', setor=self.setor, ativo=True
        )
        self.funcionario_normal = Funcionario.objects.create(
            user=self.normal_user, nome='Normal', matricula='456', setor=self.setor, ativo=True
        )
        
        # Criar equipamentos
        self.equipamento1 = Equipamento.objects.create(
            nome='Notebook', codigo='NB001', ativo=True
        )
        self.equipamento2 = Equipamento.objects.create(
            nome='Monitor', codigo='MON001', ativo=True
        )
        
        # Criar padrão
        self.padrao = Padrao.objects.create(
            nome='Padrão Teste', setor=self.setor, ativo=True
        )
        
        # Criar associações de padrão
        self.padrao_func = PadraoFuncionario.objects.create(
            padrao=self.padrao, funcionario=self.funcionario_super
        )
        self.padrao_equip = PadraoEquipamento.objects.create(
            padrao_funcionario=self.padrao_func,
            equipamento=self.equipamento1,
            quantidade=2,
            motivo='Uso diário',
            observacoes='Observação teste'
        )
    
    def test_get_padrao_superuser(self):
        request = self.factory.get(f'/alter_padrao/{self.padrao.id}/')
        request.user = self.superuser
        
        response = alter_padrao(request, self.padrao.id)
        
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['padrao']['nome'], 'Padrão Teste')
        self.assertEqual(len(response_data['padrao']['funcionarios']), 1)
        self.assertEqual(len(response_data['equipamentos']), 2)
        self.assertEqual(len(response_data['funcionarios_disponiveis']), 2)  # Superuser vê todos
    
    def test_get_padrao_normal_user(self):
        request = self.factory.get(f'/alter_padrao/{self.padrao.id}/')
        request.user = self.normal_user
        
        response = alter_padrao(request, self.padrao.id)
        
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        
        self.assertTrue(response_data['success'])
        self.assertEqual(len(response_data['funcionarios_disponiveis']), 1)  # Normal user vê apenas do seu setor
    
    def test_get_padrao_not_found(self):
        request = self.factory.get('/alter_padrao/999/')
        request.user = self.superuser
        
        response = alter_padrao(request, 999)
        
        self.assertEqual(response.status_code, 404)
        response_data = json.loads(response.content)
        self.assertFalse(response_data['success'])
        self.assertEqual(response_data['message'], 'Equipamento não encontrado')
    
    def test_put_update_padrao(self):
        data = {
            'padrao_nome': 'Padrão Atualizado',
            'padrao_id': self.padrao.id,
            'requests': [
                {
                    'operator_id': self.funcionario_super.id,
                    'item_id': self.equipamento1.id,
                    'quantity': 3,
                    'observation': 'Nova observação',
                    'motivo': 'Novo motivo'
                },
                {
                    'operator_id': self.funcionario_super.id,
                    'item_id': self.equipamento2.id,
                    'quantity': 1,
                    'observation': '',
                    'motivo': 'Motivo 2'
                }
            ]
        }
        
        request = self.factory.put(
            f'/alter_padrao/{self.padrao.id}/',
            data=json.dumps(data),
            content_type='application/json'
        )
        request.user = self.superuser
        
        response = alter_padrao(request, self.padrao.id)
        
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        
        self.assertTrue(response_data['success'])
        
        # Verificar se o padrão foi atualizado
        updated_padrao = Padrao.objects.get(id=self.padrao.id)
        self.assertEqual(updated_padrao.nome, 'Padrão Atualizado')
        
        # Verificar as associações
        padrao_funcs = PadraoFuncionario.objects.filter(padrao=updated_padrao)
        self.assertEqual(padrao_funcs.count(), 1)
        
        padrao_equips = PadraoEquipamento.objects.filter(padrao_funcionario__padrao=updated_padrao)
        self.assertEqual(padrao_equips.count(), 2)
    
    def test_put_duplicate_name(self):
        # Criar outro padrão no mesmo setor
        Padrao.objects.create(nome='Padrão Existente', setor=self.setor, ativo=True)
        
        data = {
            'padrao_nome': 'Padrão Existente',
            'padrao_id': self.padrao.id,
            'requests': []
        }
        
        request = self.factory.put(
            f'/alter_padrao/{self.padrao.id}/',
            data=json.dumps(data),
            content_type='application/json'
        )
        request.user = self.superuser
        
        response = alter_padrao(request, self.padrao.id)
        
        self.assertEqual(response.status_code, 400)
        response_data = json.loads(response.content)
        self.assertFalse(response_data['success'])
        self.assertEqual(response_data['message'], 'Já existe um padrão com este nome no mesmo setor')
    
    def test_patch_toggle_active(self):
        initial_status = self.padrao.ativo
        
        request = self.factory.patch(f'/alter_padrao/{self.padrao.id}/')
        request.user = self.superuser
        
        response = alter_padrao(request, self.padrao.id)
        
        self.assertEqual(response.status_code, 200)
        response_data = json.loads(response.content)
        
        self.assertTrue(response_data['success'])
        self.assertEqual(response_data['novo_status'], not initial_status)
        
        updated_padrao = Padrao.objects.get(id=self.padrao.id)
        self.assertEqual(updated_padrao.ativo, not initial_status)
    
    def test_invalid_method(self):
        request = self.factory.post(f'/alter_padrao/{self.padrao.id}/')
        request.user = self.superuser
        
        response = alter_padrao(request, self.padrao.id)
        
        self.assertEqual(response.status_code, 405)  # Method Not Allowed