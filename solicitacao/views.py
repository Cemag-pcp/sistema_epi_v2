from django.shortcuts import render

def add_solicitacao(request):
    
    if request.method == 'POST':
        
        print(request.POST)
    
    return render(request, 'solicitacao/solicitacao.html')