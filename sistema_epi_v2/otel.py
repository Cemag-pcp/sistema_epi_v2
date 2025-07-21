from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.sdk.resources import Resource

def setup_otel_metrics():
    # Configurar o provedor de métricas
    metric_reader = PrometheusMetricReader()
    
    metrics.set_meter_provider(
        MeterProvider(
            metric_readers=[metric_reader],
            resource=Resource.create({"service.name": "django-app"})
        )
    )
    
    # Instrumentar o Django
    DjangoInstrumentor().instrument()