from django.shortcuts import render


def checklist(request):
    return render(request, 'checklist/checklist.html')

def edit_checklist(request, id):
    return 

def historico(request):
    return render(request, 'checklist/historico.html')