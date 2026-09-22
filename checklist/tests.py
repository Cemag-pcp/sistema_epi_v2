import base64
import io
import json
import os
import tempfile
import urllib.error
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.test import TestCase
from django.urls import reverse

from usuario.models import Usuario
from .models import Checklist, FotoResposta, Inspecao, ItemResposta, Pergunta

MAQUINAS = [
    {'id': 10, 'codigo': 'Torno 1', 'descricao': 'Torno mecânico', 'setor': 'Usinagem'},
    {'id': 11, 'codigo': 'Prensa', 'descricao': 'Prensa', 'setor': 'Estamparia'},
]


class ChecklistMaquinaTests(TestCase):
    def setUp(self):
        self.user = Usuario.objects.create_superuser(matricula=9001, password='x', nome='Master')
        self.client.force_login(self.user)

    def _criar(self, **extra):
        payload = {'nome': 'Checklist teste', 'perguntas': [{'texto': 'Pergunta 1'}], **extra}
        return self.client.post(
            reverse('checklist:add-checklist-api'),
            data=json.dumps(payload),
            content_type='application/json',
        )

    @patch('checklist.views._buscar_maquinas', return_value=MAQUINAS)
    def test_lista_maquinas_com_nome_de_exibicao(self, _):
        response = self.client.get(reverse('checklist:maquinas-api'))
        self.assertEqual(response.status_code, 200)
        nomes = [m['nome'] for m in response.json()['maquinas']]
        self.assertEqual(nomes, ['Torno 1 - Torno mecânico', 'Prensa'])

    @patch('checklist.views._buscar_maquinas', side_effect=OSError('fora do ar'))
    def test_lista_maquinas_api_fora_do_ar_retorna_502(self, _):
        response = self.client.get(reverse('checklist:maquinas-api'))
        self.assertEqual(response.status_code, 502)

    @patch('checklist.views._buscar_maquinas', return_value=MAQUINAS)
    def test_cria_checklist_com_maquina(self, _):
        response = self._criar(maquina_id='10')
        self.assertEqual(response.status_code, 200)
        checklist = Checklist.objects.get(nome='Checklist teste')
        self.assertEqual(checklist.maquina_id, 10)
        self.assertEqual(checklist.maquina_nome, 'Torno 1 - Torno mecânico')

    @patch('checklist.views._buscar_maquinas', return_value=MAQUINAS)
    def test_cria_checklist_sem_maquina(self, _):
        response = self._criar(maquina_id=None)
        self.assertEqual(response.status_code, 200)
        checklist = Checklist.objects.get(nome='Checklist teste')
        self.assertIsNone(checklist.maquina_id)
        self.assertIsNone(checklist.maquina_nome)

    @patch('checklist.views._buscar_maquinas', return_value=MAQUINAS)
    def test_maquina_inexistente_retorna_400(self, _):
        response = self._criar(maquina_id=999)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Checklist.objects.exists())

    @patch('checklist.views._buscar_maquinas', side_effect=OSError('fora do ar'))
    def test_api_fora_do_ar_ao_salvar_com_maquina_retorna_502(self, _):
        response = self._criar(maquina_id=10)
        self.assertEqual(response.status_code, 502)
        self.assertFalse(Checklist.objects.exists())

    @patch('checklist.views._buscar_maquinas', side_effect=OSError('fora do ar'))
    def test_api_fora_do_ar_nao_impede_salvar_sem_maquina(self, _):
        response = self._criar()
        self.assertEqual(response.status_code, 200)


class ChecklistCardsFiltroMaquinaTests(TestCase):
    def setUp(self):
        self.user = Usuario.objects.create_superuser(matricula=9002, password='x', nome='Master')
        self.client.force_login(self.user)
        Checklist.objects.create(nome='Torno diário', ativo=True, maquina_id=10, maquina_nome='Torno 1 - Torno mecânico')
        Checklist.objects.create(nome='Prensa semanal', ativo=True, maquina_id=11, maquina_nome='Prensa')
        Checklist.objects.create(nome='Geral', ativo=True)

    def _cards(self, **params):
        response = self.client.get(reverse('checklist:checklist-cards-data-api'), params)
        self.assertEqual(response.status_code, 200)
        return {c['nome']: c for c in response.json()['checklists']}

    def test_sem_filtro_retorna_todos_e_expoe_maquina(self):
        cards = self._cards()
        self.assertEqual(set(cards), {'Torno diário', 'Prensa semanal', 'Geral'})
        self.assertEqual(cards['Torno diário']['maquina'], 'Torno 1 - Torno mecânico')
        self.assertIsNone(cards['Geral']['maquina'])

    def test_filtra_por_id_da_maquina(self):
        self.assertEqual(set(self._cards(maquina_id='10')), {'Torno diário'})
        self.assertEqual(set(self._cards(maquina_id='11')), {'Prensa semanal'})

    def test_filtro_sem_correspondencia_retorna_vazio(self):
        self.assertEqual(self._cards(maquina_id='999'), {})

    def test_filtro_invalido_e_ignorado(self):
        self.assertEqual(len(self._cards(maquina_id='abc')), 3)

    def test_filtro_de_maquina_combina_com_nome(self):
        self.assertEqual(self._cards(maquina_id='10', nome='semanal'), {})
        self.assertEqual(set(self._cards(maquina_id='10', nome='diário')), {'Torno diário'})

    def test_maquinas_em_uso_lista_so_ativos_com_maquina_sem_repetir(self):
        Checklist.objects.create(nome='Torno semanal', ativo=True, maquina_id=10, maquina_nome='Torno 1 - Torno mecânico')
        Checklist.objects.create(nome='Inativo', ativo=False, maquina_id=12, maquina_nome='Furadeira')
        response = self.client.get(reverse('checklist:maquinas-em-uso-api'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['maquinas'],
            [{'id': 11, 'nome': 'Prensa'}, {'id': 10, 'nome': 'Torno 1 - Torno mecânico'}],
        )


class InspecaoFotosTests(TestCase):
    def setUp(self):
        campo = FotoResposta._meta.get_field('foto')
        self._storage_original = campo.storage
        campo.storage = FileSystemStorage(location=tempfile.mkdtemp())
        self.addCleanup(setattr, campo, 'storage', self._storage_original)

        self.user = Usuario.objects.create_superuser(matricula=9003, password='x', nome='Master')
        self.client.force_login(self.user)
        self.checklist = Checklist.objects.create(nome='Com fotos', ativo=True)
        self.pergunta = Pergunta.objects.create(checklist=self.checklist, texto='Pergunta 1')

    def _enviar(self, *tamanhos):
        fotos = [
            {'nome': f'foto{i}.jpg', 'tipo': 'image/jpeg', 'dados': base64.b64encode(os.urandom(t)).decode()}
            for i, t in enumerate(tamanhos)
        ]
        payload = {
            'checklist': self.checklist.id,
            'respostas': [{
                'pergunta': self.pergunta.id, 'conformidade': False, 'observacao': '',
                'causa': 'x', 'acao': 'y', 'texto_pergunta_historico': 'Pergunta 1', 'fotos': fotos,
            }],
        }
        return self.client.post(
            reverse('checklist:inspection-send-checklist-api'),
            data=json.dumps(payload), content_type='application/json',
        )

    def test_salva_foto_pequena(self):
        response = self._enviar(200 * 1024)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(FotoResposta.objects.count(), 1)

    def test_salva_foto_de_celular_acima_de_2_5mb(self):
        # 3 MB viram ~4 MB em base64: antes estourava DATA_UPLOAD_MAX_MEMORY_SIZE (2,5 MB)
        response = self._enviar(3 * 1024 * 1024)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(FotoResposta.objects.count(), 1)

    def test_salva_varias_fotos_na_mesma_resposta(self):
        response = self._enviar(1024 * 1024, 1024 * 1024, 1024 * 1024)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(FotoResposta.objects.count(), 3)



class RelatorioInspecaoTests(TestCase):
    def setUp(self):
        campo = FotoResposta._meta.get_field('foto')
        self._storage_original = campo.storage
        self.tmp = tempfile.mkdtemp()
        campo.storage = FileSystemStorage(location=self.tmp)
        self.addCleanup(setattr, campo, 'storage', self._storage_original)

        self.user = Usuario.objects.create_superuser(matricula=9004, password='x', nome='Master')
        self.client.force_login(self.user)
        self.checklist = Checklist.objects.create(
            nome='Torno diário', descricao='Verificação <diária> & geral', ativo=True,
            maquina_id=10, maquina_nome='Torno 1 - Torno mecânico',
        )
        self.inspecao = Inspecao.objects.create(checklist=self.checklist)
        self.item_ok = ItemResposta.objects.create(
            inspecao=self.inspecao, conformidade=True, texto_pergunta_historico='Proteções instaladas?',
        )
        self.pergunta_nc = Pergunta.objects.create(checklist=self.checklist, texto='Óleo <ok> & limpo?')
        self.item_nc = ItemResposta.objects.create(
            inspecao=self.inspecao, pergunta=self.pergunta_nc, conformidade=False,
            texto_pergunta_historico='Óleo <ok> & limpo?',
            causas_reprovacao='Vazamento <grave> & antigo', acoes_corretivas='Trocar vedação',
            observacao='Linha 1\nLinha 2',
        )

    def _foto(self, item, nome='f.jpg'):
        buffer = BytesIO()
        Image.new('RGB', (400, 300), (200, 30, 30)).save(buffer, 'JPEG')
        return FotoResposta.objects.create(
            item_resposta=item, foto=ContentFile(buffer.getvalue(), name=nome), descricao=nome,
        )

    def _url_pagina(self, id=None):
        return reverse('checklist:inspection-report', args=[id or self.inspecao.id])

    def _url_pdf(self, id=None):
        return reverse('checklist:inspection-report-pdf', args=[id or self.inspecao.id])

    def test_pagina_mostra_dados_resumo_e_itens(self):
        response = self.client.get(self._url_pagina())
        self.assertEqual(response.status_code, 200)
        relatorio = response.context['relatorio']
        self.assertEqual((relatorio['total'], relatorio['conformes'], relatorio['nao_conformes'], relatorio['percentual']), (2, 1, 1, 50))
        self.assertEqual(relatorio['maquina'], 'Torno 1 - Torno mecânico')
        self.assertContains(response, 'Proteções instaladas?')
        self.assertContains(response, 'Trocar vedação')
        self.assertContains(response, self._url_pdf())

    def test_pagina_escapa_texto_do_usuario(self):
        response = self.client.get(self._url_pagina())
        self.assertContains(response, 'Vazamento &lt;grave&gt; &amp; antigo')
        self.assertNotContains(response, 'Vazamento <grave>')

    def test_pagina_de_inspecao_inexistente_retorna_404(self):
        self.assertEqual(self.client.get(self._url_pagina(9999)).status_code, 404)
        self.assertEqual(self.client.get(self._url_pdf(9999)).status_code, 404)

    def test_pagina_sem_maquina_indica_nao_informada(self):
        self.checklist.maquina_id = self.checklist.maquina_nome = None
        self.checklist.save()
        self.assertEqual(self.client.get(self._url_pagina()).context['relatorio']['maquina'], 'Não informada')

    def test_pdf_e_gerado_com_texto_especial(self):
        response = self.client.get(self._url_pdf())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response.content.startswith(b'%PDF'))
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn(f'ins-{self.inspecao.id:06d}', response['Content-Disposition'])

    def test_pdf_inclui_fotos(self):
        sem_foto = len(self.client.get(self._url_pdf()).content)
        self._foto(self.item_nc)
        self._foto(self.item_nc, 'g.jpg')
        response = self.client.get(self._url_pdf())
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b'%PDF'))
        self.assertGreater(len(response.content), sem_foto)

    def test_pdf_nao_quebra_se_arquivo_da_foto_sumiu(self):
        foto = self._foto(self.item_nc)
        os.remove(os.path.join(self.tmp, foto.foto.name))
        response = self.client.get(self._url_pdf())
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b'%PDF'))

    def test_pdf_de_inspecao_sem_itens(self):
        vazia = Inspecao.objects.create(checklist=self.checklist)
        response = self.client.get(self._url_pdf(vazia.id))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b'%PDF'))


class HistoricoFiltroMaquinaTests(TestCase):
    def setUp(self):
        self.user = Usuario.objects.create_superuser(matricula=9005, password='x', nome='Master')
        self.client.force_login(self.user)
        self.torno = Checklist.objects.create(nome='Torno', ativo=True, maquina_id=10, maquina_nome='Torno 1')
        self.prensa = Checklist.objects.create(nome='Prensa', ativo=False, maquina_id=11, maquina_nome='Prensa')
        self.sem_maquina = Checklist.objects.create(nome='Geral', ativo=True)
        self.sem_inspecao = Checklist.objects.create(nome='Nunca usado', ativo=True, maquina_id=12, maquina_nome='Furadeira')
        for checklist in (self.torno, self.torno, self.prensa, self.sem_maquina):
            inspecao = Inspecao.objects.create(checklist=checklist)
            ItemResposta.objects.create(inspecao=inspecao, conformidade=False, texto_pergunta_historico='x')

    def _historico(self, **params):
        response = self.client.get(reverse('checklist:historico-api'), params)
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_sem_filtro_retorna_todas_as_inspecoes_e_expoe_maquina(self):
        data = self._historico()
        self.assertEqual(data['total_count'], 4)
        maquinas = sorted(i['checklist']['maquina'] or '' for i in data['checklists'])
        self.assertEqual(maquinas, ['', 'Prensa', 'Torno 1', 'Torno 1'])

    def test_filtra_por_maquina(self):
        data = self._historico(maquina_id='10')
        self.assertEqual(data['total_count'], 2)
        self.assertEqual({i['checklist']['nome'] for i in data['checklists']}, {'Torno'})
        self.assertEqual(data['summary']['total_inspections'], 2)

    def test_filtro_inclui_checklist_desativado(self):
        self.assertEqual(self._historico(maquina_id='11')['total_count'], 1)

    def test_filtro_sem_correspondencia_e_invalido(self):
        self.assertEqual(self._historico(maquina_id='999')['total_count'], 0)
        self.assertEqual(self._historico(maquina_id='abc')['total_count'], 4)

    def test_filtro_de_maquina_combina_com_conformidade(self):
        self.assertEqual(self._historico(maquina_id='10', compliance='non-compliant')['total_count'], 2)
        self.assertEqual(self._historico(maquina_id='10', compliance='compliant')['total_count'], 0)

    def test_opcoes_do_filtro_so_com_maquinas_que_tem_inspecao(self):
        response = self.client.get(reverse('checklist:historico-maquinas-api'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()['maquinas'],
            [{'id': 11, 'nome': 'Prensa'}, {'id': 10, 'nome': 'Torno 1'}],
        )


class EditarMaquinaDoChecklistTests(TestCase):
    def setUp(self):
        self.user = Usuario.objects.create_superuser(matricula=9006, password='x', nome='Master')
        self.client.force_login(self.user)
        self.checklist = Checklist.objects.create(
            nome='Torno', ativo=True, maquina_id=10, maquina_nome='Torno 1 - Torno mecânico',
        )
        self.pergunta = Pergunta.objects.create(checklist=self.checklist, texto='P1')

    def _editar(self, **extra):
        payload = {
            'nome': 'Torno', 'descricao': '', 'ativo': True,
            'perguntas': [{'id': self.pergunta.id, 'texto': 'P1'}], **extra,
        }
        return self.client.put(
            reverse('checklist:edit-checklist-api', args=[self.checklist.id]),
            data=json.dumps(payload), content_type='application/json',
        )

    @patch('checklist.views._buscar_maquinas', return_value=MAQUINAS)
    def test_troca_a_maquina(self, _):
        response = self._editar(maquina_id='11')
        self.assertEqual(response.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertEqual((self.checklist.maquina_id, self.checklist.maquina_nome), (11, 'Prensa'))
        self.assertEqual(response.json()['maquina'], {'id': 11, 'nome': 'Prensa'})

    @patch('checklist.views._buscar_maquinas', return_value=MAQUINAS)
    def test_remove_a_maquina(self, _):
        for valor in (None, ''):
            self.checklist.maquina_id, self.checklist.maquina_nome = 10, 'Torno 1'
            self.checklist.save()
            response = self._editar(maquina_id=valor)
            self.assertEqual(response.status_code, 200)
            self.checklist.refresh_from_db()
            self.assertIsNone(self.checklist.maquina_id)
            self.assertIsNone(self.checklist.maquina_nome)
            self.assertIsNone(response.json()['maquina'])

    @patch('checklist.views._buscar_maquinas', side_effect=OSError('fora do ar'))
    def test_sem_a_chave_mantem_a_maquina_sem_consultar_a_api(self, _):
        response = self._editar()
        self.assertEqual(response.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertEqual((self.checklist.maquina_id, self.checklist.maquina_nome), (10, 'Torno 1 - Torno mecânico'))

    @patch('checklist.views._buscar_maquinas', side_effect=OSError('fora do ar'))
    def test_mesma_maquina_nao_depende_da_api(self, _):
        # Ex.: a máquina saiu do sistema de manutenção, mas o checklist continua editável
        response = self._editar(maquina_id=10)
        self.assertEqual(response.status_code, 200)
        self.checklist.refresh_from_db()
        self.assertEqual(self.checklist.maquina_nome, 'Torno 1 - Torno mecânico')

    @patch('checklist.views._buscar_maquinas', return_value=MAQUINAS)
    def test_maquina_inexistente_retorna_400_e_nao_salva_nada(self, _):
        response = self._editar(nome='Novo nome', maquina_id=999)
        self.assertEqual(response.status_code, 400)
        self.checklist.refresh_from_db()
        self.assertEqual((self.checklist.nome, self.checklist.maquina_id), ('Torno', 10))

    @patch('checklist.views._buscar_maquinas', side_effect=OSError('fora do ar'))
    def test_api_fora_do_ar_ao_trocar_retorna_502_e_nao_salva_nada(self, _):
        response = self._editar(nome='Novo nome', maquina_id=11)
        self.assertEqual(response.status_code, 502)
        self.checklist.refresh_from_db()
        self.assertEqual((self.checklist.nome, self.checklist.maquina_id), ('Torno', 10))

    def test_dados_do_checklist_para_a_tela_de_edicao_trazem_a_maquina(self):
        response = self.client.get(reverse('checklist:inspection-checklist-api', args=[self.checklist.id]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['maquina'], {'id': 10, 'nome': 'Torno 1 - Torno mecânico'})

        self.checklist.maquina_id = self.checklist.maquina_nome = None
        self.checklist.save()
        response = self.client.get(reverse('checklist:inspection-checklist-api', args=[self.checklist.id]))
        self.assertIsNone(response.json()['data']['maquina'])


class PaginaDeInspecaoTests(TestCase):
    def test_pagina_traz_o_necessario_para_rascunho_e_mobile(self):
        user = Usuario.objects.create_superuser(matricula=9007, password='x', nome='Master')
        self.client.force_login(user)
        response = self.client.get(reverse('checklist:inspection-checklist', args=[1]))
        self.assertEqual(response.status_code, 200)
        # o rascunho é salvo por usuário (aparelhos compartilhados)
        self.assertContains(response, f'data-user-id="{user.id}"')
        for elemento in (
            'id="draft-banner"', 'id="discard-draft-btn"', 'id="progress-bar"', 'id="footer-card"', 'css/inspection.css',
            'id="os-modal"', 'id="os-description"', 'id="os-result"',
        ):
            self.assertContains(response, elemento)

    def test_botao_tirar_foto_usa_a_camera_nativa_do_aparelho(self):
        # As perguntas (e o input de foto) são montadas em JS, não no template renderizado
        js = (Path(__file__).parent / 'static' / 'js' / 'inspection.js').read_text(encoding='utf-8')
        # dispara a câmera nativa via <input type="file" capture>, sem modal próprio de câmera
        self.assertIn('capture="environment"', js)
        self.assertNotIn('getUserMedia', js)

        user = Usuario.objects.create_superuser(matricula=9008, password='x', nome='Master')
        self.client.force_login(user)
        response = self.client.get(reverse('checklist:inspection-checklist', args=[1]))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'id="cameraModal"')


class RespostaFalsa:
    """Imita o retorno de urllib.request.urlopen (usado como context manager)."""

    def __init__(self, corpo):
        self.corpo = corpo

    def read(self):
        return self.corpo.encode('utf-8')

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class AbrirOrdemDeServicoTests(TestCase):
    def setUp(self):
        self.user = Usuario.objects.create_superuser(matricula=4551, password='x', nome='Master')
        self.client.force_login(self.user)
        self.checklist = Checklist.objects.create(
            nome='Torno diário', ativo=True, maquina_id=150, maquina_nome='Torno 1',
        )
        self.pergunta = Pergunta.objects.create(checklist=self.checklist, texto='P1')

    def _enviar(self, **extra):
        payload = {
            'checklist': self.checklist.id,
            'respostas': [{
                'pergunta': self.pergunta.id, 'conformidade': False, 'observacao': '', 'causa': '',
                'acao': '', 'texto_pergunta_historico': 'P1', 'fotos': [],
            }],
            **extra,
        }
        return self.client.post(
            reverse('checklist:inspection-send-checklist-api'),
            data=json.dumps(payload), content_type='application/json',
        )

    @patch('checklist.views.urllib.request.urlopen')
    def test_sem_abrir_os_nao_chama_a_api(self, urlopen):
        response = self._enviar()
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['os'])
        urlopen.assert_not_called()

    @patch('checklist.views.urllib.request.urlopen', return_value=RespostaFalsa('{"id": 77}'))
    def test_abre_os_com_o_corpo_esperado(self, urlopen):
        response = self._enviar(abrir_os=True, descricao_os='  Vazamento na mangueira  ')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['os'], {'aberta': True, 'numero': '77', 'erro': None})

        urlopen.assert_called_once()
        requisicao = urlopen.call_args[0][0]
        self.assertEqual(requisicao.full_url, 'https://www.manutencaocemag.com.br/api/public/ordens/')
        self.assertEqual(requisicao.get_method(), 'POST')
        corpo = json.loads(requisicao.data)
        inspecao = Inspecao.objects.get()
        self.assertEqual(
            {k: v for k, v in corpo.items() if k != 'descricao'},
            {'matricula': '4551', 'area': 'producao', 'maquina': 150, 'impacto_producao': 'medio', 'maq_parada': False},
        )
        self.assertEqual(
            corpo['descricao'],
            f'OS aberta a partir do preenchimento do checklist do SESMT. '
            f'Checklist: Torno diário (inspeção #{inspecao.id}).\nVazamento na mangueira',
        )

    @patch('checklist.views.urllib.request.urlopen')
    def test_a_maquina_vem_do_checklist_e_nao_do_cliente(self, urlopen):
        urlopen.return_value = RespostaFalsa('{}')
        self._enviar(abrir_os=True, descricao_os='x', maquina=999, maquina_id=999)
        self.assertEqual(json.loads(urlopen.call_args[0][0].data)['maquina'], 150)

    @patch('checklist.views.urllib.request.urlopen')
    def test_resposta_sem_numero_ainda_conta_como_aberta(self, urlopen):
        urlopen.return_value = RespostaFalsa('')
        response = self._enviar(abrir_os=True, descricao_os='x')
        self.assertEqual(response.json()['os'], {'aberta': True, 'numero': None, 'erro': None})

    @patch('checklist.views.urllib.request.urlopen')
    def test_erro_da_api_nao_desfaz_a_inspecao(self, urlopen):
        urlopen.side_effect = urllib.error.HTTPError(
            'u', 400, 'Bad Request', {}, io.BytesIO('{"error": "Máquina inválida"}'.encode('utf-8')),
        )
        response = self._enviar(abrir_os=True, descricao_os='x')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['os'], {'aberta': False, 'numero': None, 'erro': 'Máquina inválida'})
        self.assertEqual(Inspecao.objects.count(), 1)
        self.assertEqual(ItemResposta.objects.count(), 1)

    @patch('checklist.views.urllib.request.urlopen', side_effect=urllib.error.URLError('sem rede'))
    def test_api_fora_do_ar_nao_desfaz_a_inspecao(self, _):
        response = self._enviar(abrir_os=True, descricao_os='x')
        self.assertEqual(response.status_code, 200)
        os = response.json()['os']
        self.assertFalse(os['aberta'])
        self.assertIn('sistema de manutenção', os['erro'])
        self.assertEqual(Inspecao.objects.count(), 1)

    @patch('checklist.views.urllib.request.urlopen')
    def test_validacoes_acontecem_antes_de_salvar_a_inspecao(self, urlopen):
        self.assertEqual(self._enviar(abrir_os=True, descricao_os='   ').status_code, 400)
        self.assertEqual(self._enviar(abrir_os=True, descricao_os='x' * 1001).status_code, 400)
        self.assertEqual(self._enviar(abrir_os=True).status_code, 400)

        self.checklist.maquina_id = self.checklist.maquina_nome = None
        self.checklist.save()
        response = self._enviar(abrir_os=True, descricao_os='x')
        self.assertEqual(response.status_code, 400)
        self.assertIn('máquina', response.json()['error'])

        self.assertEqual(Inspecao.objects.count(), 0)
        urlopen.assert_not_called()

    def test_numero_da_os_em_formatos_diferentes(self):
        from .views import _numero_os
        self.assertEqual(_numero_os({'numero': 'OS-12'}), 'OS-12')
        self.assertEqual(_numero_os({'id': 5}), '5')
        self.assertEqual(_numero_os({'ordem': {'id': 9}}), '9')
        self.assertIsNone(_numero_os({'ok': True}))
        self.assertIsNone(_numero_os([1, 2]))

    def test_mensagem_de_erro_da_api(self):
        from .views import _mensagem_erro_api
        self.assertEqual(_mensagem_erro_api('{"error": "Falhou"}'), 'Falhou')
        self.assertEqual(_mensagem_erro_api('{"maquina": ["Inválida"], "descricao": ["Obrigatório"]}'), 'maquina: Inválida; descricao: Obrigatório')
        self.assertIsNone(_mensagem_erro_api('<html>erro</html>'))


class RespostaNaTests(TestCase):
    """Item N/A (nao se aplica) ao responder, editar, listar e relatar um checklist."""

    def setUp(self):
        self.user = Usuario.objects.create_superuser(matricula=9009, password='x', nome='Master')
        self.client.force_login(self.user)
        self.checklist = Checklist.objects.create(nome='Torno N/A', ativo=True)
        self.p1 = Pergunta.objects.create(checklist=self.checklist, texto='P1')
        self.p2 = Pergunta.objects.create(checklist=self.checklist, texto='P2')
        self.p3 = Pergunta.objects.create(checklist=self.checklist, texto='P3')

    def _resposta(self, pergunta, conformidade):
        return {
            'pergunta': pergunta.id, 'conformidade': conformidade, 'observacao': '',
            'causa': '', 'acao': '', 'texto_pergunta_historico': pergunta.texto, 'fotos': [],
        }

    def _enviar(self, respostas):
        return self.client.post(
            reverse('checklist:inspection-send-checklist-api'),
            data=json.dumps({'checklist': self.checklist.id, 'respostas': respostas}),
            content_type='application/json',
        )

    def test_envia_item_na_e_grava_conformidade_nula(self):
        response = self._enviar([self._resposta(self.p1, True), self._resposta(self.p2, 'na')])
        self.assertEqual(response.status_code, 200)
        item_ok = ItemResposta.objects.get(pergunta=self.p1)
        item_na = ItemResposta.objects.get(pergunta=self.p2)
        self.assertIs(item_ok.conformidade, True)
        self.assertIsNone(item_na.conformidade)

    def test_conformidade_invalida_e_ignorada_sem_quebrar_o_envio(self):
        response = self._enviar([
            self._resposta(self.p1, True),
            {'pergunta': self.p2.id, 'conformidade': 'talvez', 'texto_pergunta_historico': 'P2'},
            {'pergunta': self.p3.id, 'texto_pergunta_historico': 'P3'},  # sem conformidade
        ])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(ItemResposta.objects.count(), 1)

    def test_inspection_data_api_devolve_na_para_item_sem_conformidade(self):
        self._enviar([self._resposta(self.p1, True), self._resposta(self.p2, 'na')])
        inspecao = Inspecao.objects.get()
        response = self.client.get(reverse('checklist:inspection-data-api', args=[inspecao.id]))
        self.assertEqual(response.status_code, 200)
        por_pergunta = {r['pergunta_id']: r['conformidade'] for r in response.json()['respostas']}
        self.assertEqual(por_pergunta[self.p1.id], True)
        self.assertEqual(por_pergunta[self.p2.id], 'na')

    def test_update_inspection_api_marca_item_como_na(self):
        self._enviar([self._resposta(self.p1, True), self._resposta(self.p2, False)])
        inspecao = Inspecao.objects.get()
        response = self.client.post(
            reverse('checklist:update-inspection-api'),
            data=json.dumps({
                'inspection_id': inspecao.id,
                'respostas': [
                    {'pergunta_id': self.p1.id, 'conformidade': 'na', 'causa': '', 'acao': '', 'observacao': '', 'fotos': []},
                    {'pergunta_id': self.p2.id, 'conformidade': False, 'causa': 'x', 'acao': 'y', 'observacao': '', 'fotos': []},
                ],
                'fotos_remover': [],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(ItemResposta.objects.get(pergunta=self.p1).conformidade)
        self.assertIs(ItemResposta.objects.get(pergunta=self.p2).conformidade, False)

    def test_update_inspection_api_ignora_conformidade_invalida(self):
        self._enviar([self._resposta(self.p1, True)])
        inspecao = Inspecao.objects.get()
        response = self.client.post(
            reverse('checklist:update-inspection-api'),
            data=json.dumps({
                'inspection_id': inspecao.id,
                'respostas': [{'pergunta_id': self.p1.id, 'conformidade': 'invalido'}],
                'fotos_remover': [],
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        # nao deve ter sobrescrito a resposta existente com um valor invalido
        self.assertIs(ItemResposta.objects.get(pergunta=self.p1).conformidade, True)

    def test_historico_contabiliza_na_separado_de_conforme_e_nao_conforme(self):
        self._enviar([self._resposta(self.p1, True), self._resposta(self.p2, False), self._resposta(self.p3, 'na')])
        response = self.client.get(reverse('checklist:historico-api'))
        self.assertEqual(response.status_code, 200)
        stats = response.json()['checklists'][0]['stats']
        self.assertEqual(stats, {'total': 3, 'compliant': 1, 'nonCompliant': 1, 'notApplicable': 1})

    def test_historico_filtro_compliant_ignora_item_na(self):
        # So N/A e conformes, nenhum nao conforme: deve cair no filtro compliant
        self._enviar([self._resposta(self.p1, True), self._resposta(self.p2, 'na')])
        response = self.client.get(reverse('checklist:historico-api'), {'compliance': 'compliant'})
        self.assertEqual(response.json()['total_count'], 1)

    def test_relatorio_de_inspecao_com_item_na(self):
        self._enviar([self._resposta(self.p1, True), self._resposta(self.p2, False), self._resposta(self.p3, 'na')])
        inspecao = Inspecao.objects.get()
        response = self.client.get(reverse('checklist:inspection-report', args=[inspecao.id]))
        self.assertEqual(response.status_code, 200)
        relatorio = response.context['relatorio']
        self.assertEqual(relatorio['conformes'], 1)
        self.assertEqual(relatorio['nao_conformes'], 1)
        self.assertEqual(relatorio['nao_aplicaveis'], 1)
        # percentual calculado so sobre os 2 itens aplicaveis (exclui o N/A): 1/2 = 50%
        self.assertEqual(relatorio['percentual'], 50)
        status_por_item = {item['texto']: item['status'] for item in relatorio['itens']}
        self.assertEqual(status_por_item, {'P1': 'conforme', 'P2': 'nao_conforme', 'P3': 'na'})

    def test_relatorio_percentual_quando_tudo_e_na(self):
        self._enviar([self._resposta(self.p1, 'na'), self._resposta(self.p2, 'na')])
        inspecao = Inspecao.objects.get()
        response = self.client.get(reverse('checklist:inspection-report', args=[inspecao.id]))
        self.assertEqual(response.context['relatorio']['percentual'], 0)

    def test_pdf_do_relatorio_com_item_na_e_gerado(self):
        self._enviar([self._resposta(self.p1, True), self._resposta(self.p2, 'na')])
        inspecao = Inspecao.objects.get()
        response = self.client.get(reverse('checklist:inspection-report-pdf', args=[inspecao.id]))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b'%PDF'))

    def test_modelo_str_mostra_na(self):
        self._enviar([self._resposta(self.p1, 'na')])
        item = ItemResposta.objects.get(pergunta=self.p1)
        self.assertIn('N/A', str(item))

    def test_get_stats_do_checklist_com_na(self):
        self._enviar([self._resposta(self.p1, True), self._resposta(self.p2, False), self._resposta(self.p3, 'na')])
        inspecao = Inspecao.objects.get()
        stats = self.checklist.get_stats(inspecao)
        self.assertEqual(stats, {'total': 3, 'compliant': 1, 'nonCompliant': 1, 'notApplicable': 1})
