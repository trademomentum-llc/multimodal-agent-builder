// OpenTelemetry bootstrap for Node server (optional; enabled only if endpoint is set)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  try {
    const traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    });
    const sdk = new NodeSDK({
      traceExporter,
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'multimodal-agent-builder-web',
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
    process.on('SIGTERM', () => {
      sdk.shutdown().catch(() => {});
    });
  } catch {
    // never block startup due to telemetry
  }
}
