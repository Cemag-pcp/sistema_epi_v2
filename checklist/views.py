from django.shortcuts import render


def checklist(request):
    return render(request, 'checklist/checklist.html')

def create(request):
    return render(request, 'checklist/create_checklist.html')

def edit_checklist(request, id):
    return 

def historico(request):
    return render(request, 'checklist/historico.html')