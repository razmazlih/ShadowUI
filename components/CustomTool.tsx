'use client';
import AutoSizeText from './AutoSizeText';

import { useId, useState } from 'react';
import type { CustomTool as CustomToolDefinition } from '../lib/custom-tool';
import { CustomToolSchema, evaluateCustomTool } from '../lib/custom-tool';
import './custom-tool.css';

export default function CustomTool({ tool, onChange, locale = 'en', readOnlyFields = [] }: {
  tool: CustomToolDefinition;
  onChange: (tool: CustomToolDefinition) => void;
  locale?: 'he' | 'en';
  readOnlyFields?: string[];
}) {
  const prefix = useId();
  const he = locale === 'he';
  const [draft, setDraft] = useState<{ source: CustomToolDefinition; values: Record<string, string> }>({ source: tool, values: {} });
  // External replacements invalidate drafts immediately, before effects or a paint.
  const draftValues = draft.source === tool ? draft.values : {};
  const displayedTool = { ...tool, fields: tool.fields.map(field => ({ ...field, value: draftValues[field.id] ?? field.value })) };
  const results = evaluateCustomTool(displayedTool);
  const update = (id: string, value: string) => {
    const values = { ...draftValues, [id]: value };
    const candidate = { ...tool, fields: tool.fields.map(field => ({ ...field, value: values[field.id] ?? field.value })) };
    if (CustomToolSchema.safeParse(candidate).success) {
      setDraft({ source: tool, values: {} });
      onChange(candidate);
    } else {
      setDraft({ source: tool, values });
    }
  };

  return <div className={`custom-tool custom-tool--${tool.layout} custom-tool--${tool.accent}`} dir="auto">
    <p className="custom-tool-purpose">{tool.purpose}</p>
    <div className="custom-tool-fields">
      {displayedTool.fields.map((field, index) => {
        const id = `${prefix}-${field.id}`;
        const hintId = `${id}-hint`;
        const invalidNumber = field.type === 'number' && (field.value.trim() === '' || !Number.isFinite(Number(field.value)) || (field.min !== null && Number(field.value) < field.min) || (field.max !== null && Number(field.value) > field.max));
        const rangeHint = field.type === 'number' && (field.min !== null || field.max !== null)
          ? [field.min !== null ? `${he ? 'מינימום' : 'Minimum'} ${field.min}` : '', field.max !== null ? `${he ? 'מקסימום' : 'Maximum'} ${field.max}` : ''].filter(Boolean).join(' · ')
          : '';
        return <div className={`custom-tool-field${field.type === 'toggle' ? ' custom-tool-field--toggle' : ''}`} key={field.id}>
          <label htmlFor={id}>{tool.layout === 'steps' && <span className="custom-tool-step" aria-hidden="true">{index + 1}</span>}<span>{field.label}</span></label>
          {field.type === 'toggle' ? <input disabled={readOnlyFields.includes(field.id)} id={id} type="checkbox" checked={field.value === 'true'} onChange={event => update(field.id, String(event.target.checked))} />
            : field.type === 'select' ? <select disabled={readOnlyFields.includes(field.id)} id={id} value={field.value} onChange={event => update(field.id, event.target.value)}>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select>
            : field.type === 'text' ? <AutoSizeText disabled={readOnlyFields.includes(field.id)} id={id} value={field.value} maxLength={1000} onChange={event => update(field.id, event.target.value)} /> : <input disabled={readOnlyFields.includes(field.id)} id={id} type={field.type === 'number' ? 'number' : 'text'} value={field.value} min={field.type === 'number' ? field.min ?? undefined : undefined} max={field.type === 'number' ? field.max ?? undefined : undefined} step={field.type === 'number' ? 'any' : undefined}  aria-invalid={invalidNumber || undefined} aria-describedby={rangeHint || invalidNumber ? hintId : undefined} onChange={event => update(field.id, event.target.value)} />}
          {(rangeHint || invalidNumber) && <small id={hintId} className={invalidNumber ? 'custom-tool-error' : 'custom-tool-hint'}>{invalidNumber ? (he ? 'יש להזין מספר תקין בטווח המותר.' : 'Enter a valid number within the allowed range.') : rangeHint}</small>}
        </div>;
      })}
    </div>
    {results.length > 0 && <div className="custom-tool-results" aria-live="polite" aria-atomic="true">{results.map(result => <div className="custom-tool-result" key={result.id}>
      <span className="custom-tool-result-label">{result.label}</span>
      {result.value !== null && Number.isFinite(result.value) ? <output><strong dir="auto">{new Intl.NumberFormat(he ? 'he-IL' : 'en-US', { maximumFractionDigits: 4 }).format(result.value)}</strong>{result.unit && <span className="custom-tool-unit">{result.unit}</span>}</output>
        : <p className="custom-tool-error">{result.error || (he ? 'לא ניתן לחשב מהערכים האלה.' : 'Unable to calculate from these values.')}</p>}
    </div>)}</div>}
  </div>;
}
