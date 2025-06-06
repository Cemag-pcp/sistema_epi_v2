from django.http import HttpResponseForbidden
from functools import wraps
from django.shortcuts import render

def somente_master(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if (
            (request.user.is_authenticated and request.user.is_superuser == True) or
            (request.user.is_authenticated and request.user.funcionario.tipo_acesso == 'master')
        ):
            return view_func(request, *args, **kwargs)
        return render(request, 'acesso_negado.html', status=403)
    return _wrapped_view

def master_solicit(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if (
            (request.user.is_authenticated and request.user.is_superuser == True) or
            (request.user.is_authenticated and request.user.funcionario.tipo_acesso != 'operador')
        ):
            return view_func(request, *args, **kwargs)
        return render(request, 'acesso_negado.html', status=403)
    return _wrapped_view