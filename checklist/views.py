from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master, master_solicit
from django.http import JsonResponse, HttpResponse
from django.core.paginator import Paginator
from django.db.models import Count, Case, When, IntegerField, Q, Prefetch
from django.db import transaction
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.core.cache import cache
from .models import Checklist, Pergunta, Inspecao, ItemResposta, FotoResposta
from usuario.models import Setor
import json
import base64
import uuid
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from xml.sax.saxutils import escape
from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFont, ImageOps
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image as RLImage, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

MAQUINAS_API_URL = 'https://www.manutencaocemag.com.br/api/public/maquinas/'
MAQUINAS_CACHE_KEY = 'checklist_maquinas'
MAQUINAS_CACHE_TTL = 300
MAQUINAS_PAGE_SIZE = 500


def _buscar_maquinas():
    """Retorna as máquinas do sistema de manutenção (API paginada), com cache curto."""
    maquinas = cache.get(MAQUINAS_CACHE_KEY)
    if maquinas is not None:
        return maquinas

    maquinas = []
    offset = 0
    while True:
        query = urllib.parse.urlencode({'limit': MAQUINAS_PAGE_SIZE, 'offset': offset})
        req = urllib.request.Request(
            f'{MAQUINAS_API_URL}?{query}',
            headers={'User-Agent': 'Mozilla/5.0 (compatible; SistemaEPI/1.0)'},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read().decode('utf-8'))

        results = payload.get('results', [])
        maquinas.extend(
            {
                'id': m['id'],
                'codigo': m.get('codigo') or '',
                'descricao': m.get('descricao') or '',
                'setor': m.get('setor') or '',
            }
            for m in results
        )
        offset += len(results)
        if not results or offset >= payload.get('count', 0):
            break

    maquinas.sort(key=lambda m: m['codigo'].lower())
    cache.set(MAQUINAS_CACHE_KEY, maquinas, MAQUINAS_CACHE_TTL)
    return maquinas


ORDENS_API_URL = 'https://www.manutencaocemag.com.br/api/public/ordens/'
OS_DESCRICAO_PADRAO = 'OS aberta a partir do preenchimento do checklist do SESMT.'
OS_DESCRICAO_MAX = 1000  # limite do texto do usuário, para não estourar o campo do outro sistema


def _mensagem_erro_api(corpo):
    """Extrai uma mensagem legível do corpo de erro da API ({"error": "..."} ou erros por campo)."""
    try:
        dados = json.loads(corpo)
    except ValueError:
        return None
    if not isinstance(dados, dict):
        return None
    for chave in ('error', 'erro', 'detail', 'message', 'mensagem'):
        if dados.get(chave):
            return str(dados[chave])
    partes = []
    for campo, mensagens in dados.items():
        if isinstance(mensagens, (list, tuple)):
            mensagens = ', '.join(str(m) for m in mensagens)
        partes.append(f'{campo}: {mensagens}')
    return '; '.join(partes) or None


def _numero_os(resposta):
    """Procura o número/identificador da OS na resposta da API (o formato não é garantido)."""
    if not isinstance(resposta, dict):
        return None
    candidatos = [resposta] + [v for v in resposta.values() if isinstance(v, dict)]
    for dados in candidatos:
        for chave in ('numero', 'numero_os', 'codigo', 'id', 'pk'):
            valor = dados.get(chave)
            if valor not in (None, ''):
                return str(valor)
    return None


def _descricao_os(checklist, inspecao, texto_usuario):
    return (
        f'{OS_DESCRICAO_PADRAO} Checklist: {checklist.nome} (inspeção #{inspecao.id}).\n'
        f'{texto_usuario}'
    )


def _abrir_ordem_servico(matricula, maquina_id, descricao):
    """Abre uma OS no sistema de manutenção. Nunca levanta: devolve o resultado para o front."""
    payload = {
        'matricula': str(matricula),
        'area': 'producao',
        'maquina': maquina_id,
        'descricao': descricao,
        'impacto_producao': 'medio',
        'maq_parada': False,
    }
    req = urllib.request.Request(
        ORDENS_API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; SistemaEPI/1.0)',
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            corpo = resp.read().decode('utf-8')
    except urllib.error.HTTPError as exc:
        corpo_erro = exc.read().decode('utf-8', errors='replace')
        print(f'[CHECKLIST] Falha ao abrir OS: HTTP {exc.code}: {corpo_erro}')
        return {
            'aberta': False,
            'numero': None,
            'erro': _mensagem_erro_api(corpo_erro) or f'o sistema de manutenção respondeu com erro {exc.code}',
        }
    except Exception as exc:
        print(f'[CHECKLIST] Falha ao abrir OS: {exc}')
        return {'aberta': False, 'numero': None, 'erro': 'não foi possível se comunicar com o sistema de manutenção'}

    try:
        resposta = json.loads(corpo) if corpo else {}
    except ValueError:
        resposta = {}
    return {'aberta': True, 'numero': _numero_os(resposta), 'erro': None}


def _nome_maquina(maquina):
    if maquina['descricao'] and maquina['descricao'] != maquina['codigo']:
        return f"{maquina['codigo']} - {maquina['descricao']}"
    return maquina['codigo']


@login_required
@somente_master
def maquinas_api(request):
    try:
        maquinas = _buscar_maquinas()
    except Exception as exc:
        print(f'[CHECKLIST] Falha ao buscar máquinas: {exc}')
        return JsonResponse(
            {"error": "Não foi possível carregar as máquinas no momento"}, status=502
        )

    return JsonResponse(
        {"maquinas": [{**m, "nome": _nome_maquina(m)} for m in maquinas]}
    )


@login_required
@somente_master
def checklists_template(request):
    return render(request, "checklist/checklist.html")


@login_required
@somente_master
def create_template(request):
    setores = Setor.objects.all()
    return render(request, "checklist/create_checklist.html", {"setores": setores})


@login_required
@somente_master
def history_template(request):
    return render(request, "checklist/history.html")


@login_required
@somente_master
def edit_checklist_template(request, id):
    return render(request, "checklist/edit_checklist.html")


@login_required
@somente_master
def inspection_checklist_template(request, id):
    return render(request, "checklist/inspection_checklist.html")


@login_required
@somente_master
def edit_inspection_template(request, id):
    return render(request, "checklist/edit_inspection.html")


@login_required
@somente_master
def maquinas_em_uso_api(request):
    """Máquinas que possuem checklist ativo (opções do filtro da listagem)."""
    maquinas = {}
    linhas = (
        Checklist.objects.filter(ativo=True, maquina_id__isnull=False)
        .order_by("maquina_nome")
        .values("maquina_id", "maquina_nome")
    )
    for linha in linhas:
        maquinas.setdefault(linha["maquina_id"], linha["maquina_nome"])

    return JsonResponse(
        {"maquinas": [{"id": id_, "nome": nome} for id_, nome in maquinas.items()]}
    )


@login_required
@somente_master
def checklist_cards_data_api(request):
    # Obter parâmetros de filtro
    setor_filter = request.GET.get("setor", "")
    nome_filter = request.GET.get("nome", "")
    maquina_filter = request.GET.get("maquina_id", "")
    page_number = request.GET.get("page", 1)

    # Buscar checklists ativos com filtros
    checklists = Checklist.objects.filter(ativo=True).annotate(
        total_perguntas=Count("perguntas")
    )

    # Aplicar filtros
    if setor_filter:
        if setor_filter.lower() == "geral":
            checklists = checklists.filter(setor__isnull=True)
        else:
            checklists = checklists.filter(setor__nome__icontains=setor_filter)

    if nome_filter:
        checklists = checklists.filter(nome__icontains=nome_filter)

    if maquina_filter.isdigit():
        checklists = checklists.filter(maquina_id=int(maquina_filter))

    # Paginação
    checklists = checklists.order_by("-created_at")
    paginator = Paginator(checklists, 11)  # 6 itens por página
    page_obj = paginator.get_page(page_number)

    # Preparar dados para o JSON
    data = []
    for checklist in page_obj:
        tempo_estimado_min = checklist.total_perguntas
        tempo_estimado_max = checklist.total_perguntas + 5

        checklist_data = {
            "id": checklist.id,
            "nome": checklist.nome,
            "descricao": checklist.descricao,
            "total_perguntas": checklist.total_perguntas,
            "tempo_min": tempo_estimado_min,
            "tempo_max": tempo_estimado_max,
            "setor": checklist.setor.nome if checklist.setor else "Geral",
            "maquina": checklist.maquina_nome,
            "url_edit": f"/checklists/edit/{checklist.id}",
            "url_inspection": f"/checklists/inspection/{checklist.id}",
        }
        data.append(checklist_data)

    return JsonResponse(
        {
            "checklists": data,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
            "current_page": page_obj.number,
            "total_pages": paginator.num_pages,
            "total_count": paginator.count,
            "next_page_number": page_obj.next_page_number() if page_obj.has_next() else None,
            "previous_page_number": page_obj.previous_page_number() if page_obj.has_previous() else None,
        }
    )


@login_required
@somente_master
def duplicate_checklist_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            original_id = data.get("original_id")
            novo_nome = data.get("novo_nome")
            setor_id = data.get("setor_id") if data.get("setor_id") != '' else None

            # Buscar checklist original
            original = Checklist.objects.get(id=original_id)
            setor = Setor.objects.filter(id=setor_id).first()

            # Criar novo checklist
            novo_checklist = Checklist.objects.create(
                setor=setor, nome=novo_nome, descricao=original.descricao, ativo=True
            )

            # Duplicar perguntas
            perguntas = Pergunta.objects.filter(checklist=original)
            for pergunta in perguntas:
                Pergunta.objects.create(checklist=novo_checklist, texto=pergunta.texto)

            return JsonResponse(
                {"success": True, "message": "Checklist duplicado com sucesso"}
            )

        except Exception as e:
            return JsonResponse({"success": False, "message": str(e)}, status=500)

    return JsonResponse(
        {"success": False, "message": "Método não permitido"}, status=405
    )


@login_required
@somente_master
def inspection_data_api(request, id):
    try:
        # Buscar a inspeção pelo ID
        inspecao = Inspecao.objects.get(id=id)

        # Buscar todas as respostas desta inspeção com suas fotos
        respostas = ItemResposta.objects.filter(inspecao=inspecao).prefetch_related('fotos')

        # Preparar dados para retorno
        data = {
            "id": inspecao.id,
            "checklist": {
                "id": inspecao.checklist.id,
                "nome": inspecao.checklist.nome,
                "descricao": inspecao.checklist.descricao,
            },
            "inspetor": {
                "id": inspecao.inspetor.id if inspecao.inspetor else None,
                "nome": inspecao.inspetor.nome if inspecao.inspetor else "N/A",
            },
            "data_inspecao": inspecao.data_inspecao.isoformat(),
            "respostas": [
                {
                    "pergunta_id": resposta.pergunta.id if resposta.pergunta else None,
                    "texto_pergunta": resposta.texto_pergunta_historico,
                    "conformidade": resposta.conformidade,
                    "causas_reprovacao": resposta.causas_reprovacao or "",
                    "acoes_corretivas": resposta.acoes_corretivas or "",
                    "observacao": resposta.observacao or "",
                    "fotos": [
                        {
                            "id": foto.id,
                            "url": request.build_absolute_uri(foto.foto.url) if foto.foto else None,
                            "descricao": foto.descricao or "",
                            "data_upload": foto.data_upload.isoformat(),
                            "nome_arquivo": foto.foto.name.split("/")[-1] if foto.foto else None,
                        }
                        for foto in resposta.fotos.all()
                    ]
                }
                for resposta in respostas
            ],
        }

        return JsonResponse(data)

    except Inspecao.DoesNotExist:
        return JsonResponse({"error": "Inspeção não encontrada"}, status=404)


@login_required
@somente_master
def inspection_send_checklist_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            checklist_id = data.get("checklist")
            respostas_data = data.get("respostas", [])
            abrir_os = bool(data.get("abrir_os"))
            descricao_os = str(data.get("descricao_os") or "").strip()

            # Validar dados obrigatórios
            if not checklist_id:
                return JsonResponse(
                    {"error": "ID do checklist é obrigatório"}, status=400
                )

            if not respostas_data:
                return JsonResponse({"error": "Nenhuma resposta fornecida"}, status=400)

            # Buscar o checklist
            try:
                checklist = Checklist.objects.get(id=checklist_id, ativo=True)
            except Checklist.DoesNotExist:
                return JsonResponse(
                    {"error": "Checklist não encontrado ou inativo"}, status=404
                )

            # A OS é validada antes de salvar qualquer coisa: a máquina vem do checklist (não do cliente)
            if abrir_os:
                if not checklist.maquina_id:
                    return JsonResponse(
                        {"error": "Este checklist não tem máquina vinculada para abrir a ordem de serviço"},
                        status=400,
                    )
                if not descricao_os:
                    return JsonResponse(
                        {"error": "Descreva o problema para abrir a ordem de serviço"}, status=400
                    )
                if len(descricao_os) > OS_DESCRICAO_MAX:
                    return JsonResponse(
                        {"error": f"A descrição da ordem de serviço deve ter no máximo {OS_DESCRICAO_MAX} caracteres"},
                        status=400,
                    )

            # Criar a inspeção
            inspecao = Inspecao.objects.create(
                checklist=checklist,
                inspetor=(
                    request.user.funcionario
                    if hasattr(request.user, "funcionario")
                    else None
                ),
            )

            # Uma consulta só para todas as perguntas (cada ida ao banco custa ~90 ms)
            perguntas_por_id = {p.id: p for p in Pergunta.objects.filter(checklist=checklist)}

            # Processar cada resposta
            for resposta_data in respostas_data:
                pergunta_id = resposta_data.get("pergunta")
                conformidade = resposta_data.get("conformidade")
                causa = resposta_data.get("causa")
                acao = resposta_data.get("acao")
                observacao = resposta_data.get("observacao", "")
                texto_pergunta_historico = resposta_data.get(
                    "texto_pergunta_historico", ""
                )
                fotos_base64 = resposta_data.get("fotos", [])  # Fotos em base64

                # Validar dados da resposta
                if pergunta_id is None or conformidade is None:
                    continue  # Pular respostas inválidas

                # Buscar a pergunta
                pergunta = perguntas_por_id.get(pergunta_id)

                # Criar o item de resposta
                item_resposta = ItemResposta.objects.create(
                    inspecao=inspecao,
                    pergunta=pergunta,
                    conformidade=conformidade,
                    causas_reprovacao=causa,
                    acoes_corretivas=acao,
                    observacao=observacao,
                    texto_pergunta_historico=texto_pergunta_historico
                    or (pergunta.texto if pergunta else f"Pergunta ID: {pergunta_id}"),
                )

                # Processar fotos em base64 para esta resposta
                for foto_data in fotos_base64:
                    try:
                        base64_string = foto_data['dados']
                        
                        # Verificar se já é apenas dados base64 (sem prefixo)
                        if ';base64,' not in base64_string:
                            # Se não tem prefixo, assumir que é JPEG e adicionar o prefixo
                            base64_string = f"data:image/jpeg;base64,{base64_string}"
                        
                        # Agora processe normalmente
                        format, imgstr = base64_string.split(';base64,')
                        ext = format.split('/')[-1]
                        
                        # Resto do código permanece igual...
                        decoded_file = base64.b64decode(imgstr)
                        foto_file = ContentFile(
                            decoded_file,
                            name=f"pergunta_{pergunta_id}_{uuid.uuid4().hex[:8]}.{ext}"
                        )
                        
                        FotoResposta.objects.create(
                            item_resposta=item_resposta,
                            foto=foto_file,
                            descricao=foto_data.get('nome', f"Foto para pergunta {pergunta_id}")
                        )
                        
                    except Exception as e:
                        print(f"Erro ao processar foto: {str(e)}")
                        continue

            # A inspeção já está salva: uma falha na OS não pode desfazê-la, só é avisada ao usuário
            ordem_servico = None
            if abrir_os:
                ordem_servico = _abrir_ordem_servico(
                    request.user.matricula,
                    checklist.maquina_id,
                    _descricao_os(checklist, inspecao, descricao_os),
                )

            # Retornar sucesso
            return JsonResponse(
                {
                    "success": True,
                    "message": "Inspeção registrada com sucesso",
                    "inspecao_id": inspecao.id,
                    "os": ordem_servico,
                }
            )

        except json.JSONDecodeError:
            return JsonResponse({"error": "Dados JSON inválidos"}, status=400)
        except Exception as e:
            return JsonResponse(
                {"error": f"Erro ao processar inspeção: {str(e)}"}, status=500
            )

    return JsonResponse({"error": "Método não permitido"}, status=405)


@login_required
@somente_master
def update_inspection_api(request):
    if request.method == "POST":
        try:
            with transaction.atomic():
                data = json.loads(request.body)
                inspection_id = data.get("inspection_id")
                respostas_data = data.get("respostas", [])
                fotos_remover = data.get("fotos_remover", [])

                # Buscar a inspeção
                inspecao = Inspecao.objects.get(id=inspection_id)

                # Remover fotos solicitadas
                for foto_id in fotos_remover:
                    try:
                        foto = FotoResposta.objects.get(id=foto_id, item_resposta__inspecao=inspecao)
                        foto.delete()
                    except FotoResposta.DoesNotExist:
                        pass

                # Atualizar cada resposta
                for resposta_data in respostas_data:
                    pergunta_id = resposta_data.get("pergunta_id")
                    conformidade = resposta_data.get("conformidade")
                    causa = resposta_data.get("causa")
                    acao = resposta_data.get("acao")
                    observacao = resposta_data.get("observacao", "")
                    fotos_base64 = resposta_data.get("fotos", [])  # Novas fotos em base64

                    # Buscar a resposta existente
                    try:
                        resposta = ItemResposta.objects.get(
                            inspecao=inspecao, pergunta_id=pergunta_id
                        )
                        resposta.conformidade = conformidade
                        resposta.observacao = observacao
                        resposta.causas_reprovacao = causa
                        resposta.acoes_corretivas = acao
                        resposta.save()
                        
                        # Processar novas fotos em base64
                        for foto_data in fotos_base64:
                            try:
                                format, imgstr = foto_data['dados'].split(';base64,')
                                ext = format.split('/')[-1]
                                
                                foto_file = ContentFile(
                                    base64.b64decode(imgstr),
                                    name=f"pergunta_{pergunta_id}_{uuid.uuid4().hex[:8]}.{ext}"
                                )
                                
                                FotoResposta.objects.create(
                                    item_resposta=resposta,
                                    foto=foto_file,
                                    descricao=foto_data.get('nome', f"Foto para pergunta {pergunta_id}")
                                )
                            except Exception as e:
                                print(f"Erro ao processar foto: {str(e)}")
                                continue
                                
                    except ItemResposta.DoesNotExist:
                        # Se não existir, criar uma nova (caso raro)
                        pergunta = Pergunta.objects.get(id=pergunta_id)
                        resposta = ItemResposta.objects.create(
                            inspecao=inspecao,
                            pergunta=pergunta,
                            conformidade=conformidade,
                            causas_reprovacao=causa,
                            acoes_corretivas=acao,
                            observacao=observacao,
                            texto_pergunta_historico=pergunta.texto,
                        )
                        
                        # Processar fotos para a nova resposta
                        for foto_data in fotos_base64:
                            try:
                                format, imgstr = foto_data['dados'].split(';base64,')
                                ext = format.split('/')[-1]
                                
                                foto_file = ContentFile(
                                    base64.b64decode(imgstr),
                                    name=f"pergunta_{pergunta_id}_{uuid.uuid4().hex[:8]}.{ext}"
                                )
                                
                                FotoResposta.objects.create(
                                    item_resposta=resposta,
                                    foto=foto_file,
                                    descricao=foto_data.get('nome', f"Foto para pergunta {pergunta_id}")
                                )
                            except Exception as e:
                                print(f"Erro ao processar foto: {str(e)}")
                                continue

            return JsonResponse(
                {"success": True, "message": "Inspeção atualizada com sucesso"}
            )

        except Inspecao.DoesNotExist:
            return JsonResponse({"error": "Inspeção não encontrada"}, status=404)
        except Exception as e:
            return JsonResponse(
                {"error": f"Erro ao atualizar inspeção: {str(e)}"}, status=500
            )

    return JsonResponse({"error": "Método não permitido"}, status=405)


@login_required
@somente_master
def inspection_checklist_api(request, id):
    try:
        # Buscar o checklist pelo ID
        checklist = Checklist.objects.get(id=id, ativo=True)
    except Checklist.DoesNotExist:
        return JsonResponse(
            {"error": "Checklist não encontrado ou inativo"}, status=404
        )

    if request.method == "GET":
        # Retornar os dados do checklist para o frontend
        perguntas = Pergunta.objects.filter(checklist=checklist).values("id", "texto",)

        checklist_data = {
            "id": checklist.id,
            "nome": checklist.nome,
            "descricao": checklist.descricao,
            "setor": (
                {"id": checklist.setor.id, "nome": checklist.setor.nome}
                if checklist.setor
                else None
            ),
            "maquina": (
                {"id": checklist.maquina_id, "nome": checklist.maquina_nome}
                if checklist.maquina_id
                else None
            ),
            "perguntas": list(perguntas),
        }

        return JsonResponse({"data": checklist_data})


@login_required
@somente_master
def edit_checklist_api(request, id):
    """
    Endpoint para atualizar completamente um checklist existente
    Inclui todas as perguntas associadas
    """
    try:
        # Buscar o checklist
        checklist = Checklist.objects.get(id=id)
        data = json.loads(request.body)

        # Atualizar dados básicos do checklist
        checklist.nome = data.get("nome", checklist.nome)
        checklist.descricao = data.get("descricao", checklist.descricao)
        checklist.ativo = data.get("ativo", checklist.ativo)

        # Atualizar setor se fornecido
        setor_id = data.get("setor")
        if setor_id:
            try:
                checklist.setor = Setor.objects.get(id=setor_id)
            except Setor.DoesNotExist:
                return JsonResponse({"error": "Setor não encontrado"}, status=400)
        else:
            checklist.setor = None

        # Máquina: sem a chave no corpo, mantém a atual; vazio remove; id novo é validado na API
        if "maquina_id" in data:
            maquina_id = data.get("maquina_id")
            if not maquina_id:
                checklist.maquina_id = None
                checklist.maquina_nome = None
            elif str(maquina_id) != str(checklist.maquina_id):
                try:
                    maquina = next(
                        (m for m in _buscar_maquinas() if str(m["id"]) == str(maquina_id)),
                        None,
                    )
                except Exception as exc:
                    print(f"[CHECKLIST] Falha ao validar máquina: {exc}")
                    return JsonResponse(
                        {"error": "Não foi possível validar a máquina no momento. Tente novamente."},
                        status=502,
                    )
                if maquina is None:
                    return JsonResponse({"error": "Máquina não encontrada"}, status=400)
                checklist.maquina_id = maquina["id"]
                checklist.maquina_nome = _nome_maquina(maquina)

        checklist.save()

        # Processar perguntas
        perguntas_data = data.get("perguntas", [])

        # IDs de perguntas que devem ser mantidas
        perguntas_ids_manter = []

        for pergunta_data in perguntas_data:
            pergunta_id = pergunta_data.get("id")
            texto = pergunta_data.get("texto", "").strip()

            if not texto:
                continue  # Pular perguntas sem texto

            if pergunta_id:
                # Atualizar pergunta existente
                try:
                    pergunta = Pergunta.objects.get(id=pergunta_id, checklist=checklist)
                    pergunta.texto = texto
                    pergunta.save()
                    perguntas_ids_manter.append(pergunta.id)
                except Pergunta.DoesNotExist:
                    # Se a pergunta não existe ou não pertence a este checklist, criar nova
                    pergunta = Pergunta.objects.create(checklist=checklist, texto=texto)
                    perguntas_ids_manter.append(pergunta.id)
            else:
                # Criar nova pergunta
                pergunta = Pergunta.objects.create(checklist=checklist, texto=texto)
                perguntas_ids_manter.append(pergunta.id)

        # Remover perguntas que não estão mais na lista
        Pergunta.objects.filter(checklist=checklist).exclude(
            id__in=perguntas_ids_manter
        ).delete()

        # Retornar dados atualizados
        checklist_data = {
            "id": checklist.id,
            "nome": checklist.nome,
            "descricao": checklist.descricao,
            "setor": (
                {"id": checklist.setor.id, "nome": checklist.setor.nome}
                if checklist.setor
                else None
            ),
            "maquina": (
                {"id": checklist.maquina_id, "nome": checklist.maquina_nome}
                if checklist.maquina_id
                else None
            ),
            "ativo": checklist.ativo,
            "perguntas": list(
                Pergunta.objects.filter(checklist=checklist).values("id", "texto")
            ),
        }

        return JsonResponse(checklist_data)

    except Checklist.DoesNotExist:
        return JsonResponse({"error": "Checklist não encontrado"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Dados JSON inválidos"}, status=400)
    except Exception as e:
        return JsonResponse(
            {"error": f"Erro ao atualizar checklist: {str(e)}"}, status=500
        )


@login_required
@somente_master
def delete_checklist_api(request, id):
    """
    Endpoint para Excluir um checklist existente
    """
    try:
        # Buscar o checklist
        checklist = Checklist.objects.get(id=id)

        checklist.delete()

        return JsonResponse(
            {"success": True, "message": "Checklist excluído com sucesso!"}, status=200
        )

    except Checklist.DoesNotExist:
        return JsonResponse({"error": "Checklist não encontrado"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Dados JSON inválidos"}, status=400)
    except Exception as e:
        return JsonResponse(
            {"error": f"Erro ao atualizar checklist: {str(e)}"}, status=500
        )


@login_required
@somente_master
def historico_maquinas_api(request):
    """Máquinas de checklists que já tiveram inspeção (opções do filtro do histórico)."""
    maquinas = {}
    linhas = (
        Checklist.objects.filter(maquina_id__isnull=False, inspecao__isnull=False)
        .order_by("maquina_nome")
        .values("maquina_id", "maquina_nome")
        .distinct()
    )
    for linha in linhas:
        maquinas.setdefault(linha["maquina_id"], linha["maquina_nome"])

    return JsonResponse(
        {"maquinas": [{"id": id_, "nome": nome} for id_, nome in maquinas.items()]}
    )


@login_required
@somente_master
def historico_api(request):
    # Obter parâmetros de filtro
    search_term = request.GET.get("search", "").lower()
    compliance_filter = request.GET.get("compliance", "all")
    start_date = request.GET.get("start_date", "")
    end_date = request.GET.get("end_date", "")
    maquina_filter = request.GET.get("maquina_id", "")
    page_number = request.GET.get("page", 1)

    # Annotate com contagem de itens não conformes
    inspecoes = (
        Inspecao.objects.select_related("checklist", "inspetor")
        .prefetch_related("itens_resposta")
        .annotate(
            non_compliant_count=Count(
                Case(
                    When(itens_resposta__conformidade=False, then=1),
                    output_field=IntegerField(),
                )
            ),
            total_items=Count("itens_resposta"),
        )
    )

    # Aplicar filtro de busca
    if search_term:
        inspecoes = inspecoes.filter(
            Q(checklist__nome__icontains=search_term)
            | Q(checklist__descricao__icontains=search_term)
            | Q(inspetor__nome__icontains=search_term)
        )

    if maquina_filter.isdigit():
        inspecoes = inspecoes.filter(checklist__maquina_id=int(maquina_filter))

    parsed_start_date = parse_date(start_date) if start_date else None
    parsed_end_date = parse_date(end_date) if end_date else None

    if parsed_start_date:
        inspecoes = inspecoes.filter(data_inspecao__date__gte=parsed_start_date)

    if parsed_end_date:
        inspecoes = inspecoes.filter(data_inspecao__date__lte=parsed_end_date)

    # Aplicar filtro de conformidade
    if compliance_filter == "compliant":
        # Onde não há itens não conformes
        inspecoes = inspecoes.filter(non_compliant_count=0)
    elif compliance_filter == "non-compliant":
        # Onde há pelo menos um item não conforme
        inspecoes = inspecoes.filter(non_compliant_count__gt=0)

    total_count = inspecoes.count()
    total_compliant = inspecoes.filter(non_compliant_count=0).count()
    total_non_compliant = inspecoes.filter(non_compliant_count__gt=0).count()

    # Ordenar por data mais recente primeiro
    inspecoes = inspecoes.order_by("-data_inspecao")

    # Paginação
    paginator = Paginator(inspecoes, 10)  # 10 itens por página
    page_obj = paginator.get_page(page_number)

    # Serializar os dados
    data = []
    for inspecao in page_obj:
        stats = {
            "total": inspecao.total_items,
            "compliant": inspecao.total_items - inspecao.non_compliant_count,
            "nonCompliant": inspecao.non_compliant_count,
        }

        data.append(
            {
                "id": inspecao.id,
                "checklist": {
                    "id": inspecao.checklist.id,
                    "nome": inspecao.checklist.nome,
                    "descricao": inspecao.checklist.descricao,
                    "maquina": inspecao.checklist.maquina_nome,
                },
                "inspetor": {
                    "id": inspecao.inspetor.id if inspecao.inspetor else None,
                    "nome": inspecao.inspetor.nome if inspecao.inspetor else "N/A",
                },
                "data_inspecao": inspecao.data_inspecao.isoformat(),
                "stats": stats,
            }
        )

    return JsonResponse(
        {
            "checklists": data,
            "has_next": page_obj.has_next(),
            "has_previous": page_obj.has_previous(),
            "current_page": page_obj.number,
            "total_pages": paginator.num_pages,
            "total_count": paginator.count,
            "summary": {
                "total_inspections": total_count,
                "fully_compliant": total_compliant,
                "with_non_compliance": total_non_compliant,
                "start_date": start_date,
                "end_date": end_date,
            },
            "next_page_number": page_obj.next_page_number() if page_obj.has_next() else None,
            "previous_page_number": page_obj.previous_page_number() if page_obj.has_previous() else None,
        }
    )


def get_pdf_font(size, bold=False):
    font_candidates = [
        "arialbd.ttf" if bold else "arial.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    ]
    for font_name in font_candidates:
        try:
            return ImageFont.truetype(font_name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_wrapped_text(draw, text, position, font, fill, max_width, line_spacing=6):
    words = str(text).split()
    if not words:
        return position[1]

    lines = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width or not current_line:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    x, y = position
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        bbox = draw.textbbox((x, y), line, font=font)
        y += (bbox[3] - bbox[1]) + line_spacing

    return y


def measure_wrapped_text_height(draw, text, font, max_width, line_spacing=6):
    words = str(text).split()
    if not words:
        bbox = draw.textbbox((0, 0), "A", font=font)
        return bbox[3] - bbox[1]

    lines = []
    current_line = ""

    for word in words:
        test_line = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test_line, font=font)
        if bbox[2] - bbox[0] <= max_width or not current_line:
            current_line = test_line
        else:
            lines.append(current_line)
            current_line = word

    if current_line:
        lines.append(current_line)

    line_box = draw.textbbox((0, 0), "Ag", font=font)
    line_height = line_box[3] - line_box[1]
    return (len(lines) * line_height) + (max(len(lines) - 1, 0) * line_spacing)


def build_non_compliance_pdf(inspecoes, start_date, end_date, generated_at=None):
    generated_at = generated_at or timezone.localtime()
    document_code = f"RNC-{start_date.strftime('%Y%m%d')}-{end_date.strftime('%Y%m%d')}"
    total_non_compliances = sum(len(inspecao.itens_nao_conformes) for inspecao in inspecoes)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=14 * mm,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="ReportTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="ReportSection",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        spaceBefore=4,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=TA_LEFT,
    ))
    styles.add(ParagraphStyle(
        name="TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        alignment=TA_LEFT,
    ))

    story = []

    header_table = Table(
        [[
            Paragraph(
                "RELATÓRIO DE NÃO CONFORMIDADES<br/><font size='9'>Relatorio de checklists</font>",
                styles["ReportTitle"],
            ),
            Paragraph(
                f"<b>Código:</b> {document_code}<br/>"
                f"<b>Emissão:</b> {generated_at.strftime('%d/%m/%Y %H:%M')}<br/>"
                f"<b>Período:</b> {start_date.strftime('%d/%m/%Y')} a {end_date.strftime('%d/%m/%Y')}",
                styles["ReportBody"],
            ),
        ]],
        colWidths=[120 * mm, 65 * mm],
    )
    header_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(Paragraph("1. Resumo do período", styles["ReportSection"]))

    summary_table = Table(
        [
            [
                Paragraph("Período auditado", styles["TableHeader"]),
                Paragraph("Inspeções com não conformidade", styles["TableHeader"]),
                Paragraph("Itens não conformes", styles["TableHeader"]),
                Paragraph("Critério", styles["TableHeader"]),
            ],
            [
                Paragraph(f"{start_date.strftime('%d/%m/%Y')} a {end_date.strftime('%d/%m/%Y')}", styles["TableCell"]),
                Paragraph(str(len(inspecoes)), styles["TableCell"]),
                Paragraph(str(total_non_compliances), styles["TableCell"]),
                Paragraph("Itens com status não conforme no período informado.", styles["TableCell"]),
            ],
        ],
        colWidths=[48 * mm, 44 * mm, 34 * mm, 59 * mm],
        repeatRows=1,
    )
    summary_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("GRID", (0, 0), (-1, -1), 0.7, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 8))

    if not inspecoes:
        story.append(Paragraph("Nenhuma não conformidade encontrada no período informado.", styles["ReportBody"]))
    else:
        for inspection_index, inspecao in enumerate(inspecoes, start=1):
            story.append(Paragraph(f"2.{inspection_index} Inspeção", styles["ReportSection"]))

            inspection_info = Table(
                [
                    [Paragraph("Campo", styles["TableHeader"]), Paragraph("Informação", styles["TableHeader"]), Paragraph("Complemento", styles["TableHeader"])],
                    [
                        Paragraph("Checklist", styles["TableCell"]),
                        Paragraph(inspecao.checklist.nome, styles["TableCell"]),
                        Paragraph(f"Itens nao conformes: {len(inspecao.itens_nao_conformes)}", styles["TableCell"]),
                    ],
                    [
                        Paragraph("Data", styles["TableCell"]),
                        Paragraph(timezone.localtime(inspecao.data_inspecao).strftime('%d/%m/%Y %H:%M'), styles["TableCell"]),
                        Paragraph(f"Inspetor: {inspecao.inspetor.nome if inspecao.inspetor else 'N/A'}", styles["TableCell"]),
                    ],
                ],
                colWidths=[28 * mm, 103 * mm, 54 * mm],
                repeatRows=1,
            )
            inspection_info.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 1, colors.black),
                ("GRID", (0, 0), (-1, -1), 0.7, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(inspection_info)
            story.append(Spacer(1, 5))

            rows = [[
                Paragraph("N", styles["TableHeader"]),
                Paragraph("Item n?o conforme", styles["TableHeader"]),
                Paragraph("Motivo", styles["TableHeader"]),
            ]]

            for index, item in enumerate(inspecao.itens_nao_conformes, start=1):
                motivo = item.causas_reprovacao or item.observacao or "N?o informado"
                rows.append([
                    Paragraph(str(index), styles["TableCell"]),
                    Paragraph(item.texto_pergunta_historico or "Item n?o identificado", styles["TableCell"]),
                    Paragraph(motivo, styles["TableCell"]),
                ])

            non_compliance_table = Table(
                rows,
                colWidths=[12 * mm, 84 * mm, 94 * mm],
                repeatRows=1,
            )

            non_compliance_table.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 1, colors.black),
                ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(non_compliance_table)
            story.append(Spacer(1, 8))

    def draw_page(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.line(doc.leftMargin, 12 * mm, A4[0] - doc.rightMargin, 12 * mm)
        canvas.drawString(doc.leftMargin, 8 * mm, f"Emitido em {generated_at.strftime('%d/%m/%Y %H:%M')}")
        canvas.drawRightString(A4[0] - doc.rightMargin, 8 * mm, f"Página {canvas.getPageNumber()} | Documento {document_code}")
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    buffer.seek(0)
    return buffer

@login_required
@somente_master
def export_non_compliance_pdf(request):
    start_date_raw = request.GET.get("start_date", "")
    end_date_raw = request.GET.get("end_date", "")

    if not start_date_raw or not end_date_raw:
        return JsonResponse(
            {"success": False, "message": "Informe a data inicial e a data final."},
            status=400,
        )

    start_date = parse_date(start_date_raw)
    end_date = parse_date(end_date_raw)

    if not start_date or not end_date:
        return JsonResponse(
            {"success": False, "message": "Período informado inválido."},
            status=400,
        )

    if start_date > end_date:
        return JsonResponse(
            {"success": False, "message": "A data inicial não pode ser maior que a data final."},
            status=400,
        )

    inspecoes = list(
        Inspecao.objects.select_related("checklist", "inspetor")
        .prefetch_related(
            Prefetch(
                "itens_resposta",
                queryset=ItemResposta.objects.filter(conformidade=False).order_by("id"),
                to_attr="itens_nao_conformes",
            ),
        )
        .filter(
            data_inspecao__date__gte=start_date,
            data_inspecao__date__lte=end_date,
            itens_resposta__conformidade=False,
        )
        .distinct()
        .order_by("-data_inspecao")
    )

    pdf_buffer = build_non_compliance_pdf(
        inspecoes,
        start_date,
        end_date,
        generated_at=timezone.localtime(),
    )
    response = HttpResponse(pdf_buffer.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="nao-conformidades-{start_date.strftime("%Y%m%d")}-{end_date.strftime("%Y%m%d")}.pdf"'
    )
    return response


def _dados_relatorio_inspecao(inspecao):
    """Reúne o que a página e o PDF do relatório de uma inspeção precisam."""
    checklist = inspecao.checklist
    itens = []
    respostas = inspecao.itens_resposta.prefetch_related("fotos").order_by("id")
    for numero, resposta in enumerate(respostas, start=1):
        itens.append(
            {
                "numero": numero,
                "texto": resposta.texto_pergunta_historico
                or (resposta.pergunta.texto if resposta.pergunta else "Item não identificado"),
                "conforme": resposta.conformidade,
                "causas": resposta.causas_reprovacao or "",
                "acoes": resposta.acoes_corretivas or "",
                "observacao": resposta.observacao or "",
                "fotos": list(resposta.fotos.all()),
            }
        )

    total = len(itens)
    conformes = sum(1 for item in itens if item["conforme"])
    return {
        "id": inspecao.id,
        "codigo": f"INS-{inspecao.id:06d}",
        "checklist_nome": checklist.nome if checklist else "Checklist removido",
        "descricao": (checklist.descricao or "") if checklist else "",
        "setor": checklist.setor.nome if checklist and checklist.setor else "Geral",
        "maquina": (checklist.maquina_nome if checklist else None) or "Não informada",
        "inspetor": inspecao.inspetor.nome if inspecao.inspetor else "N/A",
        "data": timezone.localtime(inspecao.data_inspecao),
        "total": total,
        "conformes": conformes,
        "nao_conformes": total - conformes,
        "percentual": round(conformes / total * 100) if total else 0,
        "itens": itens,
    }


def _buscar_inspecao_relatorio(id):
    return get_object_or_404(
        Inspecao.objects.select_related("checklist__setor", "inspetor"), id=id
    )


def _imagem_para_pdf(foto, max_lado=900):
    """Lê a foto do storage e devolve (buffer JPEG reduzido, (largura, altura)) ou None."""
    try:
        with foto.foto.open("rb") as arquivo:
            imagem = ImageOps.exif_transpose(Image.open(arquivo)).convert("RGB")
        imagem.thumbnail((max_lado, max_lado))
        buffer = BytesIO()
        imagem.save(buffer, "JPEG", quality=75)
        buffer.seek(0)
        return buffer, imagem.size
    except Exception as exc:
        print(f"[CHECKLIST] Foto {foto.id} indisponível para o relatório: {exc}")
        return None


def build_inspection_pdf(relatorio, generated_at=None):
    generated_at = generated_at or timezone.localtime()

    # As fotos ficam no S3: baixa todas em paralelo para não somar a latência de cada uma
    todas_fotos = [foto for item in relatorio["itens"] for foto in item["fotos"]]
    with ThreadPoolExecutor(max_workers=6) as pool:
        imagens = dict(zip((f.id for f in todas_fotos), pool.map(_imagem_para_pdf, todas_fotos)))

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=14 * mm,
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="ReportTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=14, leading=18, alignment=TA_LEFT))
    styles.add(ParagraphStyle(name="ReportSection", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=14, spaceBefore=4, spaceAfter=4))
    styles.add(ParagraphStyle(name="ReportBody", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=12, alignment=TA_LEFT))
    styles.add(ParagraphStyle(name="TableHeader", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, alignment=TA_LEFT))
    styles.add(ParagraphStyle(name="TableCell", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=10, alignment=TA_LEFT))

    def texto(valor):
        # Paragraph interpreta marcação; o texto digitado pelo usuário precisa ser escapado
        return escape(str(valor)).replace("\n", "<br/>")

    def estilo_tabela(cabecalho=True, padding=6):
        comandos = [
            ("BOX", (0, 0), (-1, -1), 1, colors.black),
            ("GRID", (0, 0), (-1, -1), 0.7, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), padding),
            ("RIGHTPADDING", (0, 0), (-1, -1), padding),
            ("TOPPADDING", (0, 0), (-1, -1), padding),
            ("BOTTOMPADDING", (0, 0), (-1, -1), padding),
        ]
        if cabecalho:
            comandos.append(("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f2f2f2")))
        return TableStyle(comandos)

    story = []

    header_table = Table(
        [[
            Paragraph(
                "RELATÓRIO DE INSPEÇÃO<br/><font size='9'>Checklist</font>",
                styles["ReportTitle"],
            ),
            Paragraph(
                f"<b>Código:</b> {relatorio['codigo']}<br/>"
                f"<b>Emissão:</b> {generated_at.strftime('%d/%m/%Y %H:%M')}",
                styles["ReportBody"],
            ),
        ]],
        colWidths=[120 * mm, 66 * mm],
    )
    header_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 1, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("1. Dados da inspeção", styles["ReportSection"]))
    info_table = Table(
        [
            [
                Paragraph("Checklist", styles["TableHeader"]), Paragraph(texto(relatorio["checklist_nome"]), styles["TableCell"]),
                Paragraph("Data", styles["TableHeader"]), Paragraph(relatorio["data"].strftime("%d/%m/%Y %H:%M"), styles["TableCell"]),
            ],
            [
                Paragraph("Setor", styles["TableHeader"]), Paragraph(texto(relatorio["setor"]), styles["TableCell"]),
                Paragraph("Inspetor", styles["TableHeader"]), Paragraph(texto(relatorio["inspetor"]), styles["TableCell"]),
            ],
            [
                Paragraph("Máquina", styles["TableHeader"]), Paragraph(texto(relatorio["maquina"]), styles["TableCell"]),
                Paragraph("Descrição", styles["TableHeader"]), Paragraph(texto(relatorio["descricao"] or "—"), styles["TableCell"]),
            ],
        ],
        colWidths=[24 * mm, 69 * mm, 24 * mm, 69 * mm],
    )
    info_table.setStyle(estilo_tabela(cabecalho=False))
    info_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f2f2f2")), ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f2f2f2"))]))
    story.append(info_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("2. Resumo", styles["ReportSection"]))
    summary_table = Table(
        [
            [Paragraph(t, styles["TableHeader"]) for t in ("Itens", "Conformes", "Não conformes", "Conformidade")],
            [Paragraph(str(v), styles["TableCell"]) for v in (
                relatorio["total"], relatorio["conformes"], relatorio["nao_conformes"], f"{relatorio['percentual']}%",
            )],
        ],
        colWidths=[46.5 * mm] * 4,
    )
    summary_table.setStyle(estilo_tabela())
    story.append(summary_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph("3. Itens inspecionados", styles["ReportSection"]))
    if not relatorio["itens"]:
        story.append(Paragraph("Nenhum item respondido nesta inspeção.", styles["ReportBody"]))
    else:
        rows = [[Paragraph(t, styles["TableHeader"]) for t in ("N", "Item", "Status", "Detalhes")]]
        for item in relatorio["itens"]:
            status = (
                "<font color='#198754'><b>Conforme</b></font>"
                if item["conforme"]
                else "<font color='#dc3545'><b>Não conforme</b></font>"
            )
            detalhes = [
                f"<b>{rotulo}:</b> {texto(valor)}"
                for rotulo, valor in (
                    ("Causa", item["causas"]),
                    ("Ação", item["acoes"]),
                    ("Obs.", item["observacao"]),
                )
                if valor
            ]
            rows.append([
                Paragraph(str(item["numero"]), styles["TableCell"]),
                Paragraph(texto(item["texto"]), styles["TableCell"]),
                Paragraph(status, styles["TableCell"]),
                Paragraph("<br/>".join(detalhes) or "—", styles["TableCell"]),
            ])
        items_table = Table(rows, colWidths=[10 * mm, 66 * mm, 26 * mm, 84 * mm], repeatRows=1)
        items_table.setStyle(estilo_tabela(padding=5))
        story.append(items_table)

    itens_com_foto = [item for item in relatorio["itens"] if item["fotos"]]
    if itens_com_foto:
        story.append(Spacer(1, 8))
        story.append(Paragraph("4. Registro fotográfico", styles["ReportSection"]))
        largura_max, altura_max, por_linha = 58 * mm, 45 * mm, 3
        for item in itens_com_foto:
            celulas = []
            for foto in item["fotos"]:
                imagem = imagens.get(foto.id)
                if imagem is None:
                    celulas.append(Paragraph("Foto indisponível", styles["TableCell"]))
                    continue
                buffer_foto, (largura, altura) = imagem
                escala = min(largura_max / largura, altura_max / altura)
                celulas.append(RLImage(buffer_foto, width=largura * escala, height=altura * escala))

            linhas = [celulas[i:i + por_linha] for i in range(0, len(celulas), por_linha)]
            linhas = [linha + [""] * (por_linha - len(linha)) for linha in linhas]
            fotos_table = Table(linhas, colWidths=[62 * mm] * por_linha)
            fotos_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            story.append(KeepTogether([
                Paragraph(f"Item {item['numero']} - {texto(item['texto'])}", styles["ReportBody"]),
                Spacer(1, 3),
                fotos_table,
                Spacer(1, 6),
            ]))

    def draw_page(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.line(doc.leftMargin, 12 * mm, A4[0] - doc.rightMargin, 12 * mm)
        canvas.drawString(doc.leftMargin, 8 * mm, f"Emitido em {generated_at.strftime('%d/%m/%Y %H:%M')}")
        canvas.drawRightString(A4[0] - doc.rightMargin, 8 * mm, f"Página {canvas.getPageNumber()} | Documento {relatorio['codigo']}")
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    buffer.seek(0)
    return buffer


@login_required
@somente_master
def inspection_report_template(request, id):
    inspecao = _buscar_inspecao_relatorio(id)
    return render(
        request,
        "checklist/report_inspection.html",
        {"relatorio": _dados_relatorio_inspecao(inspecao)},
    )


@login_required
@somente_master
def inspection_report_pdf(request, id):
    inspecao = _buscar_inspecao_relatorio(id)
    relatorio = _dados_relatorio_inspecao(inspecao)
    pdf_buffer = build_inspection_pdf(relatorio, generated_at=timezone.localtime())
    response = HttpResponse(pdf_buffer.getvalue(), content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="relatorio-{relatorio["codigo"].lower()}-{relatorio["data"].strftime("%Y%m%d")}.pdf"'
    )
    return response


@login_required
@somente_master
def create_checklist_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            nome = data.get("nome")
            descricao = data.get("descricao", "")  # Descrição agora é opcional
            setor_id = data.get("setor_id")
            maquina_id = data.get("maquina_id")
            perguntas = data.get("perguntas", [])

            # Validar apenas dados obrigatórios (nome)
            if not nome:
                return JsonResponse(
                    {"error": "Nome do checklist é obrigatório"}, status=400
                )

            # Verificar se já existe um checklist com esse nome
            if Checklist.objects.filter(nome=nome).exists():
                return JsonResponse(
                    {"error": "Já existe um checklist com este nome"}, status=400
                )

            # Buscar setor se fornecido
            setor = None
            if setor_id:
                try:
                    setor = Setor.objects.get(id=setor_id)
                except Setor.DoesNotExist:
                    return JsonResponse({"error": "Setor não encontrado"}, status=400)

            # Validar a máquina na API de manutenção (o nome vem de lá, não do cliente)
            maquina = None
            if maquina_id:
                try:
                    maquina = next(
                        (m for m in _buscar_maquinas() if str(m["id"]) == str(maquina_id)),
                        None,
                    )
                except Exception as exc:
                    print(f"[CHECKLIST] Falha ao validar máquina: {exc}")
                    return JsonResponse(
                        {"error": "Não foi possível validar a máquina no momento. Tente novamente."},
                        status=502,
                    )
                if maquina is None:
                    return JsonResponse({"error": "Máquina não encontrada"}, status=400)

            # Criar o checklist (descrição pode ser vazia)
            checklist = Checklist.objects.create(
                nome=nome,
                descricao=descricao,  # Pode ser string vazia
                setor=setor,
                maquina_id=maquina["id"] if maquina else None,
                maquina_nome=_nome_maquina(maquina) if maquina else None,
                ativo=True,
            )

            # Criar perguntas
            for pergunta_data in perguntas:
                texto = pergunta_data.get("texto", "").strip()
                if texto:  # Só criar perguntas com texto
                    Pergunta.objects.create(checklist=checklist, texto=texto)

            # Retornar sucesso com dados do checklist criado
            return JsonResponse(
                {
                    "success": True,
                    "message": "Checklist criado com sucesso",
                    "checklist": {
                        "id": checklist.id,
                        "nome": checklist.nome,
                        "descricao": checklist.descricao,
                        "setor": checklist.setor.nome if checklist.setor else None,
                        "maquina": checklist.maquina_nome,
                        "perguntas_count": checklist.perguntas.count(),
                    },
                }
            )

        except json.JSONDecodeError:
            return JsonResponse({"error": "Dados JSON inválidos"}, status=400)
        except Exception as e:
            return JsonResponse(
                {"error": f"Erro ao criar checklist: {str(e)}"}, status=500
            )

    return JsonResponse({"error": "Método não permitido"}, status=405)
