// OpenTelemetry bootstrap for Node server (optional; enabled only if endpoint is set)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  try {
    const traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    });
    const sdk = new NodeSDK({
      traceExporter,
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]:
          'multimodal-agent-builder-web',
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start().catch(() => {});
    process.on('SIGTERM', () => {
      sdk.shutdown().catch(() => {});
    });
  } catch {
    // never block startup due to telemetry
  }
}
