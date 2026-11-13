import json

from django.test import TestCase
from django.urls import reverse

from .models import Cargo, Funcionario, Setor, Usuario


class SupervisorVariosSetoresTests(TestCase):
    """Um supervisor pode ser responsável por mais de um setor sem perder os anteriores."""

    def setUp(self):
        self.user = Usuario.objects.create_superuser(matricula=9201, password='x', nome='Master')
        self.client.force_login(self.user)
        self.solda = Setor.objects.create(nome='Solda')
        self.pintura = Setor.objects.create(nome='Pintura')
        self.cargo = Cargo.objects.create(nome='Supervisor')
        self.supervisor = Funcionario.objects.create(
            nome='Ana', matricula=5001, setor=self.solda, cargo=self.cargo, tipo_acesso='solicitante',
        )

    def _definir_responsavel(self, setor, funcionario):
        return self.client.patch(
            reverse('usuario:editar_setor', args=[setor.id]),
            data=json.dumps({'responsavel': funcionario.id}),
            content_type='application/json',
        )

    def test_supervisor_assume_segundo_setor_sem_perder_o_primeiro(self):
        self.assertEqual(self._definir_responsavel(self.solda, self.supervisor).status_code, 201)
        response = self._definir_responsavel(self.pintura, self.supervisor)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(sorted(response.json()['responsavel']['setores']), ['Pintura', 'Solda'])
        self.solda.refresh_from_db()
        self.pintura.refresh_from_db()
        self.assertEqual(self.solda.responsavel, self.supervisor)
        self.assertEqual(self.pintura.responsavel, self.supervisor)

    def test_lotacao_so_acompanha_o_primeiro_setor_supervisionado(self):
        self._definir_responsavel(self.pintura, self.supervisor)
        self.supervisor.refresh_from_db()
        self.assertEqual(self.supervisor.setor, self.pintura)

        outro = Setor.objects.create(nome='Expedição')
        self._definir_responsavel(outro, self.supervisor)
        self.supervisor.refresh_from_db()
        self.assertEqual(self.supervisor.setor, self.pintura)

    def test_trocar_responsavel_de_um_setor_nao_mexe_nos_outros(self):
        self._definir_responsavel(self.solda, self.supervisor)
        self._definir_responsavel(self.pintura, self.supervisor)
        outro = Funcionario.objects.create(nome='Bruno', matricula=5002, setor=self.pintura, cargo=self.cargo)

        self._definir_responsavel(self.pintura, outro)

        self.solda.refresh_from_db()
        self.pintura.refresh_from_db()
        self.assertEqual(self.solda.responsavel, self.supervisor)
        self.assertEqual(self.pintura.responsavel, outro)

    def test_nenhum_deixa_o_setor_sem_responsavel_sem_afetar_os_outros(self):
        self._definir_responsavel(self.solda, self.supervisor)
        self._definir_responsavel(self.pintura, self.supervisor)

        response = self.client.patch(
            reverse('usuario:editar_setor', args=[self.pintura.id]),
            data=json.dumps({'responsavel': None}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.json()['responsavel'])
        self.pintura.refresh_from_db()
        self.solda.refresh_from_db()
        self.assertIsNone(self.pintura.responsavel)
        self.assertEqual(self.solda.responsavel, self.supervisor)

    def test_responsavel_inexistente_retorna_404(self):
        response = self.client.patch(
            reverse('usuario:editar_setor', args=[self.solda.id]),
            data=json.dumps({'responsavel': 999999}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)

    def test_editar_funcionario_nao_remove_a_supervisao(self):
        self._definir_responsavel(self.solda, self.supervisor)
        self._definir_responsavel(self.pintura, self.supervisor)

        response = self.client.put(
            reverse('usuario:editar_funcionario', args=[self.supervisor.id]),
            data=json.dumps({
                'nome': 'Ana Maria', 'matricula': 5001, 'setor': 'Pintura', 'setorId': self.pintura.id,
                'cargo': 'Supervisor', 'cargoId': self.cargo.id, 'tipoAcesso': 'solicitante',
            }),
            content_type='application/json',
        )

        self.assertTrue(response.json()['success'])
        self.assertEqual(
            set(self.supervisor.setores_supervisionados.values_list('nome', flat=True)), {'Solda', 'Pintura'},
        )


class SolicitanteVariosSetoresTests(TestCase):
    """O supervisor (solicitante) enxerga a lotação e todos os setores que supervisiona."""

    def setUp(self):
        self.solda = Setor.objects.create(nome='Solda')
        self.pintura = Setor.objects.create(nome='Pintura')
        self.expedicao = Setor.objects.create(nome='Expedição')
        cargo = Cargo.objects.create(nome='Operador')
        self.ana = Funcionario.objects.create(
            nome='Ana', matricula=6001, setor=self.solda, cargo=cargo, tipo_acesso='solicitante',
        )
        self.solda.responsavel = self.ana
        self.solda.save()
        self.pintura.responsavel = self.ana
        self.pintura.save()

        self.soldador = Funcionario.objects.create(nome='Soldador', matricula=6002, setor=self.solda, cargo=cargo)
        self.pintor = Funcionario.objects.create(nome='Pintor', matricula=6003, setor=self.pintura, cargo=cargo)
        self.expedidor = Funcionario.objects.create(nome='Expedidor', matricula=6004, setor=self.expedicao, cargo=cargo)

        usuario = Usuario.objects.create_user(matricula=6001, password='x', nome='Ana', funcionario=self.ana)
        self.client.force_login(usuario)

    def test_setores_de_atuacao(self):
        self.assertEqual(self.ana.setores_de_atuacao_ids(), {self.solda.id, self.pintura.id})

    def test_solicitar_epi_lista_funcionarios_dos_setores_supervisionados(self):
        response = self.client.get(reverse('solicitacao:solicitacao_api'))
        nomes = {f['nome'] for f in response.json()['funcionarios']}
        self.assertIn('Soldador', nomes)
        self.assertIn('Pintor', nomes)
        self.assertNotIn('Expedidor', nomes)

    def test_api_setores_mostra_so_os_setores_dele(self):
        response = self.client.get(reverse('usuario:api_setores'))
        self.assertEqual({s['nome'] for s in response.json()}, {'Solda', 'Pintura'})

    def test_funcionarios_por_setor_bloqueia_setor_de_outro(self):
        permitido = self.client.get(reverse('usuario:get-funcionarios-pelo-setor', args=[self.pintura.id]))
        self.assertEqual([f['nome'] for f in permitido.json()['funcionarios']], ['Pintor'])
        bloqueado = self.client.get(reverse('usuario:get-funcionarios-pelo-setor', args=[self.expedicao.id]))
        self.assertEqual(bloqueado.status_code, 403)

    def test_padroes_listagem_criacao_e_edicao_respeitam_os_setores(self):
        from equipamento.models import Equipamento
        from padrao.models import Padrao

        equipamento = Equipamento.objects.create(nome='Luva', codigo=1, ca=1)
        Padrao.objects.create(nome='Padrão Expedição', setor=self.expedicao)

        def criar(setor, nome):
            return self.client.post(reverse('padrao:padroes-api'), data=json.dumps({
                'nome': nome, 'setor_id': setor.id,
                'funcionarios': [{'funcionario_id': self.pintor.id,
                                  'equipamentos': [{'equipamento_id': equipamento.id, 'quantidade': 1}]}],
            }), content_type='application/json')

        self.assertEqual(criar(self.pintura, 'Padrão Pintura').status_code, 200)
        self.assertEqual(criar(self.expedicao, 'Proibido').status_code, 403)

        listagem = self.client.get(reverse('padrao:padroes-api'))
        self.assertEqual([p['nome'] for p in listagem.json()['padroes']], ['Padrão Pintura'])

        pintura = Padrao.objects.get(nome='Padrão Pintura')
        detalhe = self.client.get(reverse('padrao:alter-equipamento', args=[pintura.id]))
        self.assertEqual([f['nome'] for f in detalhe.json()['funcionarios_disponiveis']], ['Pintor'])

        de_outro = Padrao.objects.get(nome='Padrão Expedição')
        self.assertEqual(self.client.get(reverse('padrao:alter-equipamento', args=[de_outro.id])).status_code, 403)
        self.assertEqual(self.client.patch(reverse('padrao:alter-equipamento', args=[de_outro.id])).status_code, 403)
