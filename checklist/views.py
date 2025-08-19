from django.shortcuts import render
from django.http import JsonResponse
from django.db.models import Count
from .models import Checklist, Pergunta
from usuario.models import Setor
import json


def checklists_template(request):
    return render(request, "checklist/checklist.html")


def create_template(request):
    return render(request, "checklist/create_checklist.html")


def history_template(request):
    return render(request, "checklist/history.html")


def edit_checklist_template(request, id):
    return render(request, "checklist/edit_checklist.html")


def inspection_checklist_template(request, id):
    return render(request, "checklist/inspection_checklist.html")


def checklist_cards_data_api(request):
    # Buscar todos os checklists ativos
    checklists = Checklist.objects.filter(ativo=True).annotate(
        total_perguntas=Count("perguntas")
    )

    # Preparar dados para o JSON
    data = []
    for checklist in checklists:
        # Calcular tempo estimado (1 minuto por pergunta)
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

    return JsonResponse({"checklists": data})


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

            # Verificar se o setor é o mesmo do original
            if original.setor.id == setor.id:
                return JsonResponse(
                    {
                        "success": False,
                        "message": "Não é possível duplicar para o mesmo setor do checklist original",
                    },
                    status=400,
                )

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


def inspection_send_checklist_api(request):

    return JsonResponse({})


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
