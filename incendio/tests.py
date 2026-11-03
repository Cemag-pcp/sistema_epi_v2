import base64
import io
import json
import tempfile
from datetime import date
from unittest.mock import patch

from PIL import Image
from django.core.files.storage import FileSystemStorage
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from usuario.models import Funcionario, Setor, Usuario
from .models import (
    ComponenteHidrante, Extintor, FotoInspecao, Hidrante, HistoricoEquipamento,
    EmpresaManutencao, InspecaoExtintor, InspecaoHidrante, ManutencaoExtintor, calcular_status,
)

HOJE = date(2026, 10, 29)


def _foto_base64():
    buffer = io.BytesIO()
    Image.new('RGB', (10, 10), 'red').save(buffer, format='JPEG')
    return 'data:image/jpeg;base64,' + base64.b64encode(buffer.getvalue()).decode()


class BaseIncendioTests(TestCase):
    def setUp(self):
        campo = FotoInspecao._meta.get_field('foto')
        self._storage_original = campo.storage
        campo.storage = FileSystemStorage(location=tempfile.mkdtemp())
        self.addCleanup(setattr, campo, 'storage', self._storage_original)

        hoje = patch('django.utils.timezone.localdate', return_value=HOJE)
        hoje.start()
        self.addCleanup(hoje.stop)

        self.user = Usuario.objects.create_superuser(matricula=9101, password='x', nome='Master')
        self.client.force_login(self.user)

    def _json(self, metodo, url, payload=None):
        return getattr(self.client, metodo)(url, data=json.dumps(payload or {}), content_type='application/json')

    def _extintor(self, **extra):
        dados = {
            'codigo': 'EXT-01', 'localizacao': 'Portaria', 'agente': 'PQS ABC', 'capacidade_kg': 6,
            'proxima_recarga': date(2027, 5, 1), 'teste_hidrostatico_ano': 2028, **extra,
        }
        return Extintor.objects.create(**dados)

    def _hidrante(self):
        hidrante = Hidrante.objects.create(codigo='H1', localizacao='Pátio')
        ComponenteHidrante.objects.create(hidrante=hidrante, nome='Mangueira 15m', quantidade=2, ordem=0)
        ComponenteHidrante.objects.create(hidrante=hidrante, nome='Lubrificação', quantidade=None, ordem=1)
        return hidrante


class StatusTests(TestCase):
    def test_nok_reprova_e_na_nao_conta(self):
        self.assertEqual(calcular_status(['ok', 'na', 'nok']), 'reprovado')
        self.assertEqual(calcular_status(['ok', 'na']), 'aprovado')
        self.assertEqual(calcular_status(['na', 'na']), 'nao_avaliado')


class ExtintorValidadeTests(BaseIncendioTests):
    def test_recarga_vale_ate_o_fim_do_mes(self):
        self.assertFalse(self._extintor(proxima_recarga=date(2026, 10, 1)).recarga_vencida)

    def test_recarga_vencida_sugere_nok(self):
        extintor = self._extintor(proxima_recarga=date(2026, 9, 1))
        self.assertTrue(extintor.recarga_vencida)
        self.assertEqual(extintor.situacao_sugerida(), 'nok')

    def test_teste_hidrostatico_vale_o_ano_inteiro(self):
        self.assertFalse(self._extintor(teste_hidrostatico_ano=2026).teste_hidrostatico_vencido)
        self.assertTrue(self._extintor(codigo='EXT-02', teste_hidrostatico_ano=2025).teste_hidrostatico_vencido)

    def test_sem_datas_sugere_na(self):
        extintor = self._extintor(proxima_recarga=None, teste_hidrostatico_ano=None)
        self.assertEqual(extintor.situacao_sugerida(), 'na')


class CadastroExtintorTests(BaseIncendioTests):
    payload = {
        'codigo': 'ext-01', 'localizacao': 'Portaria', 'numero_cilindro': '19859', 'agente': 'PQS ABC',
        'capacidade_kg': '6', 'proxima_recarga': '2027-05', 'teste_hidrostatico_ano': '2028',
    }

    def test_cria_extintor_e_registra_historico(self):
        response = self._json('post', reverse('incendio:extintor-create-api'), self.payload)
        self.assertEqual(response.status_code, 200)
        extintor = Extintor.objects.get()
        self.assertEqual(extintor.codigo, 'EXT-01')
        self.assertEqual(extintor.proxima_recarga, date(2027, 5, 1))
        self.assertEqual(extintor.historico.get().acao, 'criado')

    def test_cria_extintor_reserva(self):
        response = self._json('post', reverse('incendio:extintor-create-api'), {**self.payload, 'reserva': True})
        self.assertTrue(response.json()['extintor']['reserva'])
        self.assertTrue(Extintor.objects.get().reserva)

    def test_extintor_sem_flag_nao_e_reserva(self):
        self._json('post', reverse('incendio:extintor-create-api'), self.payload)
        self.assertFalse(Extintor.objects.get().reserva)

    def test_marcar_reserva_fica_no_historico(self):
        extintor = self._extintor()
        payload = {**self.payload, 'reserva': True}
        self._json('put', reverse('incendio:extintor-api', args=[extintor.id]), payload)
        self.assertIn('Reserva: Não → Sim', extintor.historico.get(acao='editado').descricao)

    def test_codigo_duplicado_retorna_400(self):
        self._extintor()
        response = self._json('post', reverse('incendio:extintor-create-api'), self.payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn('código', response.json()['message'])

    def test_edicao_registra_o_que_mudou(self):
        extintor = self._extintor(numero_cilindro='111')
        payload = {**self.payload, 'numero_cilindro': '222'}
        response = self._json('put', reverse('incendio:extintor-api', args=[extintor.id]), payload)
        self.assertEqual(response.status_code, 200)
        registro = extintor.historico.get(acao='editado')
        self.assertIn('Nº do cilindro: 111 → 222', registro.descricao)

    def test_patch_desativa_e_ativa(self):
        extintor = self._extintor()
        url = reverse('incendio:extintor-api', args=[extintor.id])
        self.assertFalse(self._json('patch', url).json()['novo_status'])
        self.assertTrue(self._json('patch', url).json()['novo_status'])
        self.assertEqual(
            list(extintor.historico.values_list('acao', flat=True)), ['ativado', 'desativado']
        )

    def test_historico_api(self):
        extintor = self._extintor()
        self._json('patch', reverse('incendio:extintor-api', args=[extintor.id]))
        response = self.client.get(reverse('incendio:historico-api', args=['extintor', extintor.id]))
        self.assertEqual(response.json()['historico'][0]['acao'], 'desativado')


class CadastroHidranteTests(BaseIncendioTests):
    def test_cria_hidrante_com_componentes(self):
        payload = {'codigo': 'h1', 'localizacao': 'Pátio', 'componentes': [
            {'nome': 'Mangueira 15m', 'quantidade': '2'}, {'nome': 'Brita', 'quantidade': ''}, {'nome': ' '},
        ]}
        response = self._json('post', reverse('incendio:hidrante-create-api'), payload)
        self.assertEqual(response.status_code, 200)
        hidrante = Hidrante.objects.get(codigo='H1')
        self.assertEqual(hidrante.descricao_componentes(), '02 Mangueira 15m, Brita')

    def test_edicao_mantem_atualiza_e_remove_componentes(self):
        hidrante = self._hidrante()
        mangueira = hidrante.componentes.get(nome='Mangueira 15m')
        payload = {'codigo': 'H1', 'localizacao': 'Pátio', 'componentes': [
            {'id': mangueira.id, 'nome': 'Mangueira 15m', 'quantidade': 3},
            {'id': None, 'nome': 'Esguicho', 'quantidade': 1},
        ]}
        response = self._json('put', reverse('incendio:hidrante-api', args=[hidrante.id]), payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(hidrante.componentes.get(id=mangueira.id).quantidade, 3)
        self.assertEqual(list(hidrante.componentes.values_list('nome', flat=True)), ['Mangueira 15m', 'Esguicho'])
        self.assertTrue(hidrante.historico.filter(acao='editado').exists())


class InspecaoExtintorTests(BaseIncendioTests):
    def _inspecao(self, extintor, **itens):
        payload = {'extintor': extintor.id, 'situacao': 'ok', 'estado': 'ok', 'manometro': 'ok', 'lacre': 'ok', **itens}
        return self._json('post', reverse('incendio:inspecao-extintor-create-api'), payload)

    def test_inspecao_aprovada_copia_dados_e_registra_historico(self):
        extintor = self._extintor(numero_cilindro='19859')
        response = self._inspecao(extintor, manometro='na', fotos=[{'nome': 'f.jpg', 'dados': _foto_base64()}])
        self.assertEqual(response.status_code, 200)
        inspecao = InspecaoExtintor.objects.get()
        self.assertEqual(inspecao.status, 'aprovado')
        self.assertEqual(inspecao.numero_cilindro_historico, '19859')
        self.assertEqual(inspecao.inspetor, self.user)
        self.assertEqual(inspecao.fotos.count(), 1)
        self.assertEqual(extintor.historico.get().acao, 'inspecionado')

    def test_nok_exige_observacao(self):
        extintor = self._extintor()
        self.assertEqual(self._inspecao(extintor, lacre='nok').status_code, 400)
        response = self._inspecao(extintor, lacre='nok', observacao='Lacre rompido')
        self.assertEqual(response.json()['inspecao']['status'], 'reprovado')

    def test_todos_na_fica_nao_avaliado(self):
        response = self._inspecao(self._extintor(), situacao='na', estado='na', manometro='na', lacre='na')
        self.assertEqual(response.json()['inspecao']['status'], 'nao_avaliado')

    def test_item_sem_resposta_retorna_400(self):
        self.assertEqual(self._inspecao(self._extintor(), estado=None).status_code, 400)

    def test_extintor_desativado_nao_pode_ser_inspecionado(self):
        self.assertEqual(self._inspecao(self._extintor(ativo=False)).status_code, 404)

    def test_edicao_e_exclusao_ficam_no_historico(self):
        extintor = self._extintor()
        inspecao_id = self._inspecao(extintor).json()['inspecao']['id']
        url = reverse('incendio:inspecao-extintor-api', args=[inspecao_id])

        payload = {'situacao': 'ok', 'estado': 'nok', 'manometro': 'ok', 'lacre': 'ok', 'observacao': 'Amassado'}
        response = self._json('put', url, payload)
        self.assertEqual(response.json()['inspecao']['status'], 'reprovado')
        registro = extintor.historico.get(acao='inspecao_editada')
        self.assertIn('Estado: OK → NOK', registro.descricao)

        self.assertEqual(self.client.delete(url).status_code, 200)
        self.assertFalse(InspecaoExtintor.objects.exists())
        self.assertTrue(extintor.historico.filter(acao='inspecao_excluida').exists())

    def test_edicao_remove_foto(self):
        extintor = self._extintor()
        inspecao_id = self._inspecao(extintor, fotos=[{'nome': 'f.jpg', 'dados': _foto_base64()}]).json()['inspecao']['id']
        foto = FotoInspecao.objects.get()
        payload = {'situacao': 'ok', 'estado': 'ok', 'manometro': 'ok', 'lacre': 'ok', 'fotos_remover': [foto.id]}
        self._json('put', reverse('incendio:inspecao-extintor-api', args=[inspecao_id]), payload)
        self.assertFalse(FotoInspecao.objects.exists())

    def test_cadastro_alterado_depois_nao_muda_inspecao(self):
        extintor = self._extintor(localizacao='Portaria')
        self._inspecao(extintor)
        extintor.localizacao = 'Refeitório'
        extintor.save()
        self.assertEqual(InspecaoExtintor.objects.get().localizacao_historico, 'Portaria')


class InspecaoHidranteTests(BaseIncendioTests):
    def _payload(self, hidrante, encontrada=2, **extra):
        mangueira = hidrante.componentes.get(nome='Mangueira 15m')
        lubrificacao = hidrante.componentes.get(nome='Lubrificação')
        return {
            'hidrante': hidrante.id, 'funcionamento': 'ok',
            'itens': [
                {'componente_id': mangueira.id, 'quantidade_encontrada': encontrada, 'resultado': 'ok'},
                {'componente_id': lubrificacao.id, 'resultado': 'na'},
            ],
            **extra,
        }

    def test_inspecao_aprovada(self):
        hidrante = self._hidrante()
        response = self._json('post', reverse('incendio:inspecao-hidrante-create-api'), self._payload(hidrante))
        self.assertEqual(response.status_code, 200)
        inspecao = InspecaoHidrante.objects.get()
        self.assertEqual(inspecao.status, 'aprovado')
        self.assertFalse(inspecao.falta_equipamento)
        self.assertEqual(inspecao.itens.count(), 2)

    def test_quantidade_menor_preenche_falta_equipamento(self):
        hidrante = self._hidrante()
        payload = self._payload(hidrante, encontrada=1)
        payload['itens'][0]['resultado'] = 'nok'
        payload['observacao'] = 'Mangueira sumiu'
        response = self._json('post', reverse('incendio:inspecao-hidrante-create-api'), payload)
        dados = response.json()['inspecao']
        self.assertTrue(dados['falta_equipamento'])
        self.assertEqual(dados['falta_descricao'], 'Mangueira 15m: previsto 2, encontrado 1')
        self.assertEqual(dados['status'], 'reprovado')

    def test_componente_na_nao_conta_como_falta(self):
        hidrante = self._hidrante()
        payload = self._payload(hidrante, encontrada=0)
        payload['itens'][0]['resultado'] = 'na'
        response = self._json('post', reverse('incendio:inspecao-hidrante-create-api'), payload)
        self.assertFalse(response.json()['inspecao']['falta_equipamento'])

    def test_todos_os_componentes_devem_ser_respondidos(self):
        hidrante = self._hidrante()
        payload = self._payload(hidrante)
        payload['itens'].pop()
        response = self._json('post', reverse('incendio:inspecao-hidrante-create-api'), payload)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(InspecaoHidrante.objects.exists())

    def test_edicao_atualiza_itens_e_status(self):
        hidrante = self._hidrante()
        inspecao = self._json('post', reverse('incendio:inspecao-hidrante-create-api'), self._payload(hidrante)).json()['inspecao']
        itens = [{**i, 'resultado': 'nok' if i['nome'] == 'Lubrificação' else i['resultado']} for i in inspecao['itens']]
        payload = {'funcionamento': 'ok', 'itens': itens, 'observacao': 'Sem lubrificação'}
        response = self._json('put', reverse('incendio:inspecao-hidrante-api', args=[inspecao['id']]), payload)
        self.assertEqual(response.json()['inspecao']['status'], 'reprovado')
        self.assertIn('Aprovado → Reprovado', hidrante.historico.get(acao='inspecao_editada').descricao)


class PaginasTests(BaseIncendioTests):
    def test_paginas_abrem(self):
        extintor = self._extintor()
        hidrante = self._hidrante()
        inspecao = InspecaoExtintor(extintor=extintor, situacao='ok', estado='ok', manometro='ok', lacre='ok')
        inspecao.copiar_dados_extintor()
        inspecao.atualizar_status()
        inspecao.save()

        urls = [
            reverse('incendio:extintores'),
            reverse('incendio:hidrantes'),
            reverse('incendio:cadastros'),
            reverse('incendio:inspecao-extintor', args=[extintor.qr_token]),
            reverse('incendio:inspecao-hidrante', args=[hidrante.qr_token]),
            reverse('incendio:editar-inspecao-extintor', args=[inspecao.id]),
        ]
        for url in urls:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_pendentes_do_mes(self):
        self._extintor()
        response = self.client.get(reverse('incendio:extintores'))
        self.assertEqual(response.context['indicadores']['pendentes'], 1)

    def test_qrcode_aponta_para_a_inspecao(self):
        extintor = self._extintor()
        response = self.client.get(reverse('incendio:qrcode', args=['extintor', extintor.id]))
        self.assertEqual(response['Content-Type'], 'image/svg+xml')
        self.assertIn(b'<svg', response.content)

    def test_etiquetas_pdf(self):
        self._extintor()
        response = self.client.get(reverse('incendio:etiquetas') + '?tipo=extintor')
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))

    def test_qr_sem_login_redireciona_para_login_e_volta(self):
        extintor = self._extintor()
        self.client.logout()
        url = reverse('incendio:inspecao-extintor', args=[extintor.qr_token])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 302)
        self.assertIn(f'next={url}', response['Location'])

    def test_operador_nao_acessa(self):
        setor = Setor.objects.create(nome='Produção')
        funcionario = Funcionario.objects.create(nome='Op', matricula=9102, setor=setor, tipo_acesso='operador')
        operador = Usuario.objects.create_user(matricula=9102, password='x', nome='Op', funcionario=funcionario)
        self.client.force_login(operador)
        self.assertEqual(self.client.get(reverse('incendio:extintores')).status_code, 403)
        self.assertEqual(self._json('post', reverse('incendio:extintor-create-api'), {}).status_code, 403)


class ManutencaoTests(BaseIncendioTests):
    def setUp(self):
        super().setUp()
        self.extintor = self._extintor(codigo='EXT-01', localizacao='Portaria', agente='CO2')
        self.reserva = self._extintor(codigo='EXT-43', localizacao='RESERVA', agente='CO2', reserva=True)
        self.empresa = EmpresaManutencao.objects.create(nome='Extintores LTDA')

    def _enviar(self, **extra):
        payload = {'extintor': self.extintor.id, 'reserva': self.reserva.id, 'motivo': 'recarga',
                   'empresa': self.empresa.id, 'data_envio': '2026-10-20', **extra}
        return self._json('post', reverse('incendio:manutencao-enviar-api'), payload)

    def _receber(self, id, repor, **extra):
        payload = {'repor': repor, 'data_recebimento': '2026-10-28', **extra}
        return self._json('post', reverse('incendio:manutencao-receber-api', args=[id]), payload)

    def _recarregar(self):
        self.extintor.refresh_from_db()
        self.reserva.refresh_from_db()

    def test_envio_coloca_reserva_no_local_e_registra_historico(self):
        response = self._enviar()
        self.assertEqual(response.status_code, 200)
        self._recarregar()
        self.assertEqual(self.extintor.localizacao, 'MANUTENÇÃO EXTERNA')
        self.assertEqual(self.reserva.localizacao, 'Portaria')
        m = ManutencaoExtintor.objects.get()
        self.assertEqual((m.status, m.localizacao_original, m.localizacao_reserva_anterior),
                         ('em_manutencao', 'Portaria', 'RESERVA'))
        self.assertTrue(self.extintor.historico.filter(acao='enviado_manutencao').exists())
        self.assertTrue(self.reserva.historico.filter(acao='reserva_alocada').exists())

    def test_nao_envia_extintor_ja_em_manutencao_nem_reserva_ocupada(self):
        self._enviar()
        self.assertEqual(self._enviar().status_code, 400)
        outro = self._extintor(codigo='EXT-02', localizacao='Refeitório')
        self.assertEqual(self._enviar(extintor=outro.id).status_code, 400)  # reserva já está cobrindo a Portaria

    def test_reserva_precisa_estar_marcada_como_reserva(self):
        outro = self._extintor(codigo='EXT-02', localizacao='Refeitório')
        self.assertEqual(self._enviar(reserva=outro.id).status_code, 404)

    def test_envio_guarda_empresa(self):
        dados = self._enviar(motivo='preventiva').json()['manutencao']
        self.assertEqual(dados['empresa'], 'Extintores LTDA')
        self.assertEqual(dados['motivo_display'], 'Manutenção preventiva')
        self.assertEqual(self._enviar(extintor=self._extintor(codigo='EXT-02').id, reserva=None,
                                      empresa=9999).status_code, 404)

    def test_cadastro_rapido_de_empresa_reaproveita_nome_igual(self):
        url = reverse('incendio:empresa-create-api')
        criada = self._json('post', url, {'nome': '  Nova   Empresa '}).json()['empresa']
        self.assertEqual(criada['nome'], 'Nova Empresa')
        repetida = self._json('post', url, {'nome': 'nova empresa'}).json()['empresa']
        self.assertEqual(repetida['id'], criada['id'])
        self.assertEqual(self._json('post', url, {'nome': ' '}).status_code, 400)
        self.assertEqual(EmpresaManutencao.objects.count(), 2)

    def test_envio_sem_reserva(self):
        self.assertEqual(self._enviar(reserva=None).status_code, 200)
        self.assertIsNone(ManutencaoExtintor.objects.get().reserva)

    def test_recebimento_repondo_volta_tudo_ao_lugar_e_atualiza_datas(self):
        id = self._enviar().json()['manutencao']['id']
        response = self._receber(id, True, proxima_recarga='2027-10', teste_hidrostatico_ano='2031')
        self.assertEqual(response.status_code, 200)
        self._recarregar()
        self.assertEqual(self.extintor.localizacao, 'Portaria')
        self.assertEqual(self.extintor.proxima_recarga, date(2027, 10, 1))
        self.assertEqual(self.extintor.teste_hidrostatico_ano, 2031)
        self.assertFalse(self.extintor.reserva)
        self.assertEqual(self.reserva.localizacao, 'RESERVA')
        self.assertTrue(self.reserva.reserva)
        registro = self.extintor.historico.get(acao='recebido_manutencao')
        self.assertIn('Próxima recarga: 05/2027 → 10/2027', registro.descricao)

    def test_recebimento_sem_repor_troca_os_papeis(self):
        id = self._enviar().json()['manutencao']['id']
        self._receber(id, False)
        self._recarregar()
        self.assertTrue(self.extintor.reserva)
        self.assertEqual(self.extintor.localizacao, 'RESERVA')
        self.assertFalse(self.reserva.reserva)
        self.assertEqual(self.reserva.localizacao, 'Portaria')
        self.assertFalse(ManutencaoExtintor.objects.get().reposto)

    def test_recebimento_exige_resposta_e_data_valida(self):
        id = self._enviar().json()['manutencao']['id']
        self.assertEqual(self._receber(id, None).status_code, 400)
        self.assertEqual(self._receber(id, True, data_recebimento='2026-10-01').status_code, 400)
        self.assertEqual(ManutencaoExtintor.objects.get().status, 'em_manutencao')

    def test_nao_recebe_duas_vezes(self):
        id = self._enviar().json()['manutencao']['id']
        self._receber(id, True)
        self.assertEqual(self._receber(id, True).status_code, 400)

    def test_cancelar_desfaz_trocas_e_mantem_registro(self):
        id = self._enviar().json()['manutencao']['id']
        url = reverse('incendio:manutencao-cancelar-api', args=[id])
        self.assertEqual(self._json('post', url, {}).status_code, 400)  # motivo obrigatório
        self.assertEqual(self._json('post', url, {'motivo': 'Lançado errado'}).status_code, 200)
        self._recarregar()
        self.assertEqual(self.extintor.localizacao, 'Portaria')
        self.assertEqual(self.reserva.localizacao, 'RESERVA')
        self.assertEqual(ManutencaoExtintor.objects.get().status, 'cancelado')
        # Depois de cancelado, os dois voltam a ficar disponíveis
        self.assertEqual(self._enviar().status_code, 200)

    def test_extintor_em_manutencao_nao_e_inspecionado_nem_fica_pendente(self):
        self._enviar()
        payload = {'extintor': self.extintor.id, 'situacao': 'ok', 'estado': 'ok', 'manometro': 'na', 'lacre': 'ok'}
        response = self._json('post', reverse('incendio:inspecao-extintor-create-api'), payload)
        self.assertEqual(response.status_code, 400)
        pendentes = self.client.get(reverse('incendio:extintores')).context['pendentes']
        self.assertEqual([e.codigo for e in pendentes], ['EXT-43'])

    def test_historico_por_extintor(self):
        primeira = self._enviar(data_envio='2026-09-01').json()['manutencao']['id']
        self._receber(primeira, True, data_recebimento='2026-09-11')
        cancelada = self._enviar(data_envio='2026-10-01').json()['manutencao']['id']
        self._json('post', reverse('incendio:manutencao-cancelar-api', args=[cancelada]), {'motivo': 'Engano'})
        self._enviar(data_envio='2026-10-20', motivo='preventiva')

        dados = self.client.get(reverse('incendio:manutencao-historico-extintor-api', args=[self.extintor.id])).json()
        self.assertEqual([m['status'] for m in dados['envios']], ['em_manutencao', 'cancelado', 'recebido'])
        # Cancelado não conta; 10 dias da primeira + 9 dias da atual (até 29/10)
        self.assertEqual(dados['resumo']['envios'], 2)
        self.assertEqual(dados['resumo']['dias_fora'], 10 + 9)
        self.assertTrue(dados['resumo']['em_manutencao'])

        reserva = self.client.get(reverse('incendio:manutencao-historico-extintor-api', args=[self.reserva.id])).json()
        self.assertEqual(reserva['resumo']['coberturas'], 2)
        self.assertEqual(reserva['envios'], [])

        pagina = self.client.get(reverse('incendio:historico-manutencao'))
        linhas = {e['codigo']: e for e in pagina.context['extintores']}
        self.assertEqual(linhas['EXT-01']['total_envios'], 2)
        self.assertEqual(linhas['EXT-01']['ultimo_motivo'], 'Manutenção preventiva')
        self.assertEqual(linhas['EXT-43']['total_envios'], 0)
        self.assertEqual(linhas['EXT-43']['total_coberturas'], 2)

    def test_paginas_abrem(self):
        self._enviar()
        self.assertEqual(self.client.get(reverse('incendio:manutencao')).status_code, 200)
        self.assertEqual(self.client.get(reverse('incendio:historico-manutencao') + f'?extintor={self.extintor.id}').status_code, 200)
        cadastros = self.client.get(reverse('incendio:cadastros')).context['extintores']
        self.assertEqual({e['codigo']: e['em_manutencao'] for e in cadastros}, {'EXT-01': True, 'EXT-43': False})
        inspecao = self.client.get(reverse('incendio:inspecao-extintor', args=[self.extintor.qr_token]))
        self.assertContains(inspecao, 'manutenção externa')


class ImportacaoTests(TestCase):
    def test_importa_planilha_sem_duplicar(self):
        call_command('importar_incendio', stdout=io.StringIO())
        call_command('importar_incendio', stdout=io.StringIO())
        self.assertEqual(Extintor.objects.filter(reserva=False).count(), 42)
        self.assertEqual(Extintor.objects.filter(reserva=True).count(), 9)
        self.assertEqual(Hidrante.objects.count(), 8)
        self.assertIsNone(Extintor.objects.get(codigo='EXT-06').numero_cilindro)
        self.assertEqual(Extintor.objects.get(codigo='EXT-05').agente, 'PQS BC')
        self.assertEqual(Hidrante.objects.get(codigo='H1').descricao_componentes(), '02 Mangueira 15m, 03 Esguicho, 01 Chave')
        self.assertEqual(HistoricoEquipamento.objects.filter(acao='criado').count(), 59)

    def test_reservas_so_cria_as_que_faltam_sem_alterar_outros(self):
        call_command('importar_incendio', stdout=io.StringIO())
        posto = Extintor.objects.get(codigo='EXT-01')
        posto.localizacao = 'Editado pela tela'
        posto.save()
        Extintor.objects.filter(codigo='EXT-53').delete()

        call_command('importar_incendio', '--reservas', stdout=io.StringIO())

        self.assertEqual(Extintor.objects.get(codigo='EXT-01').localizacao, 'Editado pela tela')
        reserva = Extintor.objects.get(codigo='EXT-53')
        self.assertTrue(reserva.reserva)
        self.assertEqual(reserva.localizacao, 'RESERVA')
        self.assertEqual(reserva.proxima_recarga, date(2027, 9, 1))
        self.assertFalse(Extintor.objects.filter(codigo__in=['EXT-48', 'EXT-51']).exists())
