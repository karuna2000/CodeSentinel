import type { Attributes, Context } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace';
import { sanitizeTelemetryMetadata } from './observability-sanitize';
import { observabilityConfig } from './observability-config';

/** All exporters receive a scrubbed copy, including spans created by SDKs. */
export class SanitizingSpanProcessor implements SpanProcessor {
  constructor(private readonly delegate: SpanProcessor) {}

  onStart(span: Span, parent: Context): void {
    try { this.delegate.onStart(span, parent); } catch { /* optional sink */ }
  }

  onEnd(span: ReadableSpan): void {
    if (!observabilityConfig().enabled) return;
    try {
      const clean = (attrs: Attributes | undefined): Attributes =>
        sanitizeTelemetryMetadata(attrs ?? {}) as Attributes;
      this.delegate.onEnd({
        name: span.name, kind: span.kind, spanContext: () => span.spanContext(),
        parentSpanContext: span.parentSpanContext,
        startTime: span.startTime, endTime: span.endTime, duration: span.duration,
        ended: span.ended, resource: span.resource, instrumentationScope: span.instrumentationScope,
        droppedAttributesCount: span.droppedAttributesCount,
        droppedEventsCount: span.droppedEventsCount, droppedLinksCount: span.droppedLinksCount,
        attributes: clean(span.attributes),
        status: { code: span.status.code },
        events: span.events.map(event => ({ ...event, attributes: clean(event.attributes) })),
        links: span.links.map(link => ({ ...link, attributes: clean(link.attributes) })),
      });
    } catch { /* Never substitute an exporter failure for an application result. */ }
  }

  async forceFlush(): Promise<void> { try { await this.delegate.forceFlush(); } catch { /* optional */ } }
  async shutdown(): Promise<void> { try { await this.delegate.shutdown(); } catch { /* optional */ } }
}
