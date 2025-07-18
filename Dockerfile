# Dockerfile
FROM python:3.12-slim

WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copia os requirements primeiro para aproveitar cache de camadas
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o resto da aplicação
COPY . .

# Expõe as portas necessárias
EXPOSE 8000 9464

# Comando para rodar a aplicação
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "sistema_epi_v2.wsgi:application"]