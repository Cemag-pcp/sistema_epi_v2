from django.shortcuts import render
from django.http import JsonResponse
from django.core.paginator import Paginator
from django.db.models import Count, Q
from .models import Checklist, Pergunta, Inspecao, ItemResposta
from usuario.models import Setor
import json


def checklists_template(request):
    return render(request, "checklist/checklist.html")


def create_template(request):
    setores = Setor.objects.all()
    return render(request, "checklist/create_checklist.html", {'setores': setores})


def history_template(request):
    return render(request, "checklist/history.html")


def edit_checklist_template(request, id):
    return render(request, "checklist/edit_checklist.html")


def inspection_checklist_template(request, id):
    return render(request, "checklist/inspection_checklist.html")


def edit_inspection_template(request, id):
    return render(request, "checklist/edit_inspection.html")


def checklist_cards_data_api(request):
    # Obter parâmetros de filtro
    setor_filter = request.GET.get('setor', '')
    nome_filter = request.GET.get('nome', '')
    page_number = request.GET.get('page', 1)
    
    # Buscar checklists ativos com filtros
    checklists = Checklist.objects.filter(ativo=True).annotate(
        total_perguntas=Count("perguntas")
    )
    
    # Aplicar filtros
    if setor_filter:
        if setor_filter.lower() == 'geral':
            checklists = checklists.filter(setor__isnull=True)
        else:
            checklists = checklists.filter(setor__nome__icontains=setor_filter)
    
    if nome_filter:
        checklists = checklists.filter(nome__icontains=nome_filter)
    
    # Paginação
    checklists = checklists.order_by('-created_at')
    paginator = Paginator(checklists, 6)  # 6 itens por página
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

    return JsonResponse({
        "checklists": data,
        "has_next": page_obj.has_next(),
        "has_previous": page_obj.has_previous(),
        "current_page": page_obj.number,
        "total_pages": paginator.num_pages,
        "total_count": paginator.count
    })

def duplicate_checklist_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            original_id = data.get("original_id")
            novo_nome = data.get("novo_nome")
            setor_id = data.get("setor_id")

            # Buscar checklist original
            original = Checklist.objects.get(id=original_id)
            setor = Setor.objects.get(id=setor_id)

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
        perguntas = Pergunta.objects.filter(checklist=checklist).values("id", "texto")

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

# views.py
def inspection_data_api(request, id):
    try:
        # Buscar a inspeção pelo ID
        inspecao = Inspecao.objects.get(id=id)
        
        # Buscar todas as respostas desta inspeção
        respostas = ItemResposta.objects.filter(inspecao=inspecao)
        
        # Preparar dados para retorno
        data = {
            'id': inspecao.id,
            'checklist': {
                'id': inspecao.checklist.id,
                'nome': inspecao.checklist.nome,
                'descricao': inspecao.checklist.descricao
            },
            'inspetor': {
                'id': inspecao.inspetor.id if inspecao.inspetor else None,
                'nome': inspecao.inspetor.nome if inspecao.inspetor else 'N/A',
            },
            'data_inspecao': inspecao.data_inspecao.isoformat(),
            'respostas': [
                {
                    'pergunta_id': resposta.pergunta.id if resposta.pergunta else None,
                    'texto_pergunta': resposta.texto_pergunta_historico,
                    'conformidade': resposta.conformidade,
                    'observacao': resposta.observacao or ''
                }
                for resposta in respostas
            ]
        }
        
        return JsonResponse(data)
    
    except Inspecao.DoesNotExist:
        return JsonResponse({'error': 'Inspeção não encontrada'}, status=404)


# views.py
def inspection_send_checklist_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            checklist_id = data.get("checklist")
            respostas_data = data.get("respostas", [])
            
            # Validar dados obrigatórios
            if not checklist_id:
                return JsonResponse({"error": "ID do checklist é obrigatório"}, status=400)
            
            if not respostas_data:
                return JsonResponse({"error": "Nenhuma resposta fornecida"}, status=400)
            
            # Buscar o checklist
            try:
                checklist = Checklist.objects.get(id=checklist_id, ativo=True)
            except Checklist.DoesNotExist:
                return JsonResponse({"error": "Checklist não encontrado ou inativo"}, status=404)
            
            # Criar a inspeção
            inspecao = Inspecao.objects.create(
                checklist=checklist,
                inspetor=request.user.funcionario if hasattr(request.user, 'funcionario') else None
            )
            
            # Processar cada resposta
            for resposta_data in respostas_data:
                pergunta_id = resposta_data.get("pergunta")
                conformidade = resposta_data.get("conformidade")
                observacao = resposta_data.get("observacao", "")
                texto_pergunta_historico = resposta_data.get("texto_pergunta_historico", "")
                
                # Validar dados da resposta
                if pergunta_id is None or conformidade is None:
                    continue  # Pular respostas inválidas
                
                # Buscar a pergunta
                try:
                    pergunta = Pergunta.objects.get(id=pergunta_id, checklist=checklist)
                except Pergunta.DoesNotExist:
                    # Se a pergunta não existir, usar o texto histórico se disponível
                    pergunta = None
                
                # Criar o item de resposta
                ItemResposta.objects.create(
                    inspecao=inspecao,
                    pergunta=pergunta,
                    conformidade=conformidade,
                    observacao=observacao,
                    texto_pergunta_historico=texto_pergunta_historico or (pergunta.texto if pergunta else f"Pergunta ID: {pergunta_id}")
                )
            
            # Retornar sucesso
            return JsonResponse({
                "success": True,
                "message": "Inspeção registrada com sucesso",
                "inspecao_id": inspecao.id
            })
            
        except json.JSONDecodeError:
            return JsonResponse({"error": "Dados JSON inválidos"}, status=400)
        except Exception as e:
            return JsonResponse({"error": f"Erro ao processar inspeção: {str(e)}"}, status=500)
    
    return JsonResponse({"error": "Método não permitido"}, status=405)

# views.py
def update_inspection_api(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            inspection_id = data.get("inspection_id")
            
            # Buscar a inspeção
            inspecao = Inspecao.objects.get(id=inspection_id)
            
            # Atualizar cada resposta
            for resposta_data in data.get("respostas", []):
                pergunta_id = resposta_data.get("pergunta_id")
                conformidade = resposta_data.get("conformidade")
                observacao = resposta_data.get("observacao", "")
                
                # Buscar a resposta existente
                try:
                    resposta = ItemResposta.objects.get(
                        inspecao=inspecao, 
                        pergunta_id=pergunta_id
                    )
                    resposta.conformidade = conformidade
                    resposta.observacao = observacao
                    resposta.save()
                except ItemResposta.DoesNotExist:
                    # Se não existir, criar uma nova (caso raro)
                    pergunta = Pergunta.objects.get(id=pergunta_id)
                    ItemResposta.objects.create(
                        inspecao=inspecao,
                        pergunta=pergunta,
                        conformidade=conformidade,
                        observacao=observacao,
                        texto_pergunta_historico=pergunta.texto
                    )
            
            return JsonResponse({"success": True, "message": "Inspeção atualizada com sucesso"})
            
        except Inspecao.DoesNotExist:
            return JsonResponse({"error": "Inspeção não encontrada"}, status=404)
        except Exception as e:
            return JsonResponse({"error": f"Erro ao atualizar inspeção: {str(e)}"}, status=500)
    
    return JsonResponse({"error": "Método não permitido"}, status=405)


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
        perguntas = Pergunta.objects.filter(checklist=checklist).values("id", "texto")

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


def historico_api(request):
    # Obter parâmetros de filtro
    search_term = request.GET.get("search", "").lower()
    compliance_filter = request.GET.get("compliance", "all")

    # Query base com prefetch related para otimização
    inspecoes = (
        Inspecao.objects.select_related("checklist", "inspetor")
        .prefetch_related("itens_resposta")
        .all()
    )

    # Aplicar filtro de busca
    if search_term:
        inspecoes = inspecoes.filter(
            Q(checklist__nome__icontains=search_term)
            | Q(checklist__descricao__icontains=search_term)
            | Q(inspetor__nome__icontains=search_term)
        )

    # Serializar os dados
    data = []
    for inspecao in inspecoes:
        # Calcular estatísticas
        itens = inspecao.itens_resposta.all()
        total = itens.count()
        compliant = itens.filter(conformidade=True).count()
        non_compliant = total - compliant

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
                    "nome": (
                        inspecao.inspetor.nome
                        if inspecao.inspetor
                        else "Inspetor não informado"
                    ),
                },
                "data_inspecao": inspecao.data_inspecao.isoformat(),
                "stats": {
                    "total": total,
                    "compliant": compliant,
                    "nonCompliant": non_compliant,
                },
                "responses": [
                    {
                        "pergunta": {
                            "id": item.pergunta.id if item.pergunta else None,
                            "texto": item.texto_pergunta_historico
                            or (
                                item.pergunta.texto
                                if item.pergunta
                                else "Pergunta não encontrada"
                            ),
                        },
                        "conformidade": item.conformidade,
                        "observacao": item.observacao,
                    }
                    for item in itens
                ],
            }
        )

    return JsonResponse(data, safe=False, json_dumps_params={"ensure_ascii": False})


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
                return JsonResponse({"error": "Nome do checklist é obrigatório"}, status=400)
            
            # Verificar se já existe um checklist com esse nome
            if Checklist.objects.filter(nome=nome).exists():
                return JsonResponse({"error": "Já existe um checklist com este nome"}, status=400)
            
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
                ativo=True
            )
            
            # Criar perguntas
            for pergunta_data in perguntas:
                texto = pergunta_data.get("texto", "").strip()
                if texto:  # Só criar perguntas com texto
                    Pergunta.objects.create(
                        checklist=checklist,
                        texto=texto
                    )
            
            # Retornar sucesso com dados do checklist criado
            return JsonResponse({
                "success": True,
                "message": "Checklist criado com sucesso",
                "checklist": {
                    "id": checklist.id,
                    "nome": checklist.nome,
                    "descricao": checklist.descricao,
                    "setor": checklist.setor.nome if checklist.setor else None,
                    "perguntas_count": checklist.perguntas.count()
                }
            })
            
        except json.JSONDecodeError:
            return JsonResponse({"error": "Dados JSON inválidos"}, status=400)
        except Exception as e:
            return JsonResponse({"error": f"Erro ao criar checklist: {str(e)}"}, status=500)
    
    return JsonResponse({"error": "Método não permitido"}, status=405)