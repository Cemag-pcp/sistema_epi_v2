from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from usuario.decorators import somente_master, master_solicit
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.db.models import Count, Case, When, IntegerField, Q
from .models import Checklist, Pergunta, Inspecao, ItemResposta, FotoResposta
from usuario.models import Setor
import json
import base64
import uuid
from django.core.files.base import ContentFile


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
def checklist_cards_data_api(request):
    # Obter parâmetros de filtro
    setor_filter = request.GET.get("setor", "")
    nome_filter = request.GET.get("nome", "")
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
            print(data)
            print(respostas_data)

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

            # Criar a inspeção
            inspecao = Inspecao.objects.create(
                checklist=checklist,
                inspetor=(
                    request.user.funcionario
                    if hasattr(request.user, "funcionario")
                    else None
                ),
            )

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
                try:
                    pergunta = Pergunta.objects.get(id=pergunta_id, checklist=checklist)
                except Pergunta.DoesNotExist:
                    pergunta = None

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

            # Retornar sucesso
            return JsonResponse(
                {
                    "success": True,
                    "message": "Inspeção registrada com sucesso",
                    "inspecao_id": inspecao.id,
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
                    pass  # Foto já não existe

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
def historico_api(request):
    # Obter parâmetros de filtro
    search_term = request.GET.get("search", "").lower()
    compliance_filter = request.GET.get("compliance", "all")
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

    # Aplicar filtro de conformidade
    if compliance_filter == "compliant":
        # Onde não há itens não conformes
        inspecoes = inspecoes.filter(non_compliant_count=0)
    elif compliance_filter == "non-compliant":
        # Onde há pelo menos um item não conforme
        inspecoes = inspecoes.filter(non_compliant_count__gt=0)

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
            "next_page_number": page_obj.next_page_number() if page_obj.has_next() else None,
            "previous_page_number": page_obj.previous_page_number() if page_obj.has_previous() else None,
        }
    )


@login_required
@somente_master
def create_checklist_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            nome = data.get("nome")
            descricao = data.get("descricao", "")  # Descrição agora é opcional
            setor_id = data.get("setor_id")
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

            # Criar o checklist (descrição pode ser vazia)
            checklist = Checklist.objects.create(
                nome=nome,
                descricao=descricao,  # Pode ser string vazia
                setor=setor,
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
