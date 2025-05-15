from django.http import HttpResponseForbidden
from functools import wraps

def somente_master(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if request.user.is_authenticated and request.user.tipo_acesso == 'master':
            return view_func(request, *args, **kwargs)
        return HttpResponseForbidden("<h2>Acesso restrito a usuários master.</h2>")
    return _wrapped_view