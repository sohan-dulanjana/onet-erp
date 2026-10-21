import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, FileText, History, Plus, RefreshCw, Save, Send, ShieldCheck, Boxes, ArrowDownToLine, ArrowUpFromLine, ChevronDown, ChevronRight, Eye, Trash2, Calculator, TrendingUp, TrendingDown, FilePlus2, ArrowRight, CircleDollarSign, X } from 'lucide-react';
import { api } from './api';

const money = (v: unknown) => `LKR ${Number(v ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const err = (e: unknown) => e instanceof Error ? e.message : 'Request failed';
function Heading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>; }
function Btn({ children, onClick, disabled, variant = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) { return <button className={`btn ${variant}`} onClick={onClick} disabled={disabled} type="button">{children}</button>; }
function Loading() { return <div className="loading-state"><span className="loading-dots" aria-label="Loading"><i /><i /><i /><i /></span><span>Loading your workspace…</span></div>; }
function ErrorLine({ message }: { message: string }) { return message ? <div className="inline-error"><AlertCircle size={16} /><span>{message}</span></div> : null; }

/* ---------- shared helpers for the friendly screens ---------- */
const boxStyle: CSSProperties = { border: '1px solid rgba(128,128,128,.25)', borderRadius: 12, padding: 14, marginBottom: 12 };
const rowStyle: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' };
const mutedStyle: CSSProperties = { opacity: 0.7, fontSize: 12.5 };
const codeStyle: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, background: 'rgba(128,128,128,.12)', padding: '2px 7px', borderRadius: 6 };
const fmtDate = (v: any) => v ? new Date(v).toLocaleString() : '—';
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const camelKey = (s: string) => { const parts = s.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean); return parts.map((p, i) => i === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1)).join('') || ''; };
const validVar = (s: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const REV_STATUS: Record<string, string> = { DRAFT: 'Draft (not in use)', PUBLISHED: 'Live', ARCHIVED: 'Retired', SUPERSEDED: 'Retired' };
const revStatus = (s: string) => REV_STATUS[s] || String(s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
const liveRevision = (d: any) => [...(d?.revisions || [])].filter((r: any) => r.status === 'PUBLISHED').sort((a: any, b: any) => b.revision - a.revision)[0];
const humanize = (key: string) => {
  let k = String(key);
  let suffix = '';
  if (/Mm2$/.test(k)) { k = k.replace(/Mm2$/, ''); suffix = ' (mm²)'; }
  else if (/Mm$/.test(k)) { k = k.replace(/Mm$/, ''); suffix = ' (mm)'; }
  else if (/Lkr$/.test(k)) { k = k.replace(/Lkr$/, ''); suffix = ' (LKR)'; }
  else if (/Pct$/.test(k)) { k = k.replace(/Pct$/, ''); suffix = ' %'; }
  else if (/Id$/.test(k) && k.length > 2) { k = k.replace(/Id$/, ''); }
  const spaced = k.replace(/[_\-.]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return (spaced.charAt(0).toUpperCase() + spaced.slice(1)) + suffix;
};
const isMoneyKey = (k: string) => /(price|rate|cost|total|amount)/i.test(k) && !/(area|qty|quantity|thickness|pct|coats|sides)/i.test(k);
const showVal = (key: string, v: any): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) && !/^\d{4}-\d{2}-\d{2}/.test(v))) {
    const n = Number(v);
    return isMoneyKey(key) ? money(n) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleDateString();
  return String(v).replace(/_/g, ' ');
};
function flatten(obj: any, prefix = '', out: { key: string; label: string; value: any }[] = []) {
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    if (obj.every(x => typeof x !== 'object' || x === null)) out.push({ key: prefix, label: humanize(prefix.split('.').pop() || prefix), value: obj.join(', ') });
    else obj.forEach((x, i) => flatten(x, `${prefix}.${i + 1}`, out));
    return out;
  }
  if (typeof obj === 'object') {
    Object.entries(obj).forEach(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object') flatten(v, path, out);
      else out.push({ key: path, label: path.split('.').map(p => /^\d+$/.test(p) ? `#${p}` : humanize(p)).join(' › '), value: v });
    });
  }
  return out;
}

/* =====================================================================
   FORMULA MANAGEMENT
   Built-in cost sheets (Flat / Dicky / Sunk) live in the backend code.
   This screen is for ADDITIONAL product formats that staff can define
   themselves. A format with a "Live" version appears in
   New costing → Custom format.
   ===================================================================== */
const defaultSchema = { fields: [{ key: 'W', label: 'Width (mm)', type: 'number', required: true, min: 1 }, { key: 'H', label: 'Height (mm)', type: 'number', required: true, min: 1 }, { key: 'D', label: 'Depth (mm)', type: 'number', required: true, min: 1 }] };
const defaultConfig = { currency: 'LKR', defaultMarginPct: 0.2, roundingIncrement: 10, priceBindings: [], components: [] };

type InputRow = { uid: string; key: string; label: string; required: boolean; min: string; raw: any };
type CompRow = { uid: string; name: string; code: string; mode: 'direct' | 'qty'; costFormula: string; quantityFormula: string; unitCostFormula: string; raw: any };

function FormulaSummary({ rev }: { rev: any }) {
  const fields: any[] = rev?.inputSchema?.fields || [];
  const cfg = rev?.formulaConfig || {};
  const comps: any[] = cfg.components || [];
  return <div>
    <div style={boxStyle}>
      <b>Measurements entered by the user</b>
      <div className="chips" style={{ marginTop: 8 }}>{fields.length ? fields.map((f: any) => <span className="chip" key={f.key}>{f.label || f.key} <span style={codeStyle}>{f.key}</span></span>) : <small className="muted">None</small>}</div>
    </div>
    <div style={boxStyle}>
      <b>What gets calculated</b>
      <div className="table-wrap" style={{ marginTop: 8 }}><table><thead><tr><th>Cost item</th><th>How it is calculated</th></tr></thead><tbody>
        {comps.length ? comps.map((c: any, i: number) => <tr key={c.code || i}><td><b>{c.name || c.code}</b><br /><small className="muted">{c.code}</small></td><td>{c.costFormula ? <span style={codeStyle}>{c.costFormula}</span> : <span><span style={codeStyle}>{c.quantityFormula || '—'}</span> <small className="muted">(quantity)</small> × <span style={codeStyle}>{c.unitCostFormula || '—'}</span> <small className="muted">(unit cost)</small></span>}</td></tr>) : <tr><td colSpan={2} className="empty-cell">No cost items added yet.</td></tr>}
      </tbody></table></div>
    </div>
    <div className="result-mini-stats">
      <div><span>Profit margin</span><b>{(Number(cfg.defaultMarginPct ?? 0) * 100).toFixed(1)}%</b></div>
      <div><span>Round price to</span><b>{cfg.currency || 'LKR'} {cfg.roundingIncrement ?? '—'}</b></div>
      <div><span>Linked prices</span><b>{(cfg.priceBindings || []).length}</b></div>
    </div>
  </div>;
}

function FormulaEditor({ mode, format, baseRev, onClose, onSaved }: { mode: 'create' | 'revision'; format?: any; baseRev?: any; onClose: () => void; onSaved: (row: any) => void }) {
  const sch = baseRev?.inputSchema ?? defaultSchema;
  const cfg = baseRev?.formulaConfig ?? defaultConfig;
  const [step, setStep] = useState<1 | 2 | 3>(mode === 'create' ? 1 : 2);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [meta, setMeta] = useState({ code: '', name: '', familyCode: 'ENCLOSURE', familyName: 'Metal Enclosures', surfaceType: 'CUSTOM' });
  const [inputs, setInputs] = useState<InputRow[]>((sch.fields || []).map((f: any) => ({ uid: uid(), key: f.key || '', label: f.label || '', required: f.required !== false, min: f.min !== undefined ? String(f.min) : '', raw: f })));
  const [comps, setComps] = useState<CompRow[]>((cfg.components || []).map((c: any) => ({ uid: uid(), name: c.name || '', code: c.code || '', mode: c.costFormula !== undefined && c.costFormula !== null ? 'direct' : (c.quantityFormula !== undefined ? 'qty' : 'direct'), costFormula: c.costFormula || '', quantityFormula: c.quantityFormula || '', unitCostFormula: c.unitCostFormula || '', raw: c })));
  const [margin, setMargin] = useState(String(Number(((cfg.defaultMarginPct ?? 0.2) * 100).toFixed(4))));
  const [rounding, setRounding] = useState(String(cfg.roundingIncrement ?? 10));
  const [currency, setCurrency] = useState(cfg.currency || 'LKR');
  const [bindingsText, setBindingsText] = useState(JSON.stringify(cfg.priceBindings ?? [], null, 2));
  const [showBindings, setShowBindings] = useState(false);

  const bindingKeys: string[] = useMemo(() => { try { const b = JSON.parse(bindingsText); return Array.isArray(b) ? b.map((x: any) => x?.key).filter(Boolean) : []; } catch { return []; } }, [bindingsText]);
  const variables = useMemo(() => [...inputs.map(i => i.key).filter(validVar), ...bindingKeys], [inputs, bindingKeys]);

  const updInput = (id: string, patch: Partial<InputRow>) => setInputs(old => old.map(x => x.uid === id ? { ...x, ...patch } : x));
  const updComp = (id: string, patch: Partial<CompRow>) => setComps(old => old.map(x => x.uid === id ? { ...x, ...patch } : x));
  const append = (id: string, field: 'costFormula' | 'quantityFormula' | 'unitCostFormula', token: string) => setComps(old => old.map(x => x.uid === id ? { ...x, [field]: `${x[field]}${x[field] && !/[\s(]$/.test(x[field]) ? ' ' : ''}${token}` } : x));

  const validate = (upTo: number): string => {
    if (upTo >= 1 && mode === 'create') { if (!meta.code.trim()) return 'Enter a format code.'; if (!meta.name.trim()) return 'Enter a format name.'; if (!meta.familyCode.trim()) return 'Enter a product family.'; }
    if (upTo >= 2) {
      if (!inputs.length) return 'Add at least one measurement.';
      const keys = new Set<string>();
      for (const i of inputs) {
        if (!i.label.trim()) return 'Every measurement needs a label.';
        if (!validVar(i.key)) return `“${i.key || '(empty)'}” is not a valid variable name. Use letters, numbers and underscore, and start with a letter.`;
        if (keys.has(i.key)) return `Variable name “${i.key}” is used twice.`;
        keys.add(i.key);
      }
    }
    if (upTo >= 3) {
      if (!comps.length) return 'Add at least one cost item.';
      for (const c of comps) {
        if (!c.name.trim()) return 'Every cost item needs a name.';
        if (c.mode === 'direct' && !c.costFormula.trim()) return `Enter a formula for “${c.name}”.`;
        if (c.mode === 'qty' && (!c.quantityFormula.trim() || !c.unitCostFormula.trim())) return `Enter both quantity and unit cost formulas for “${c.name}”.`;
        for (const f of [c.costFormula, c.quantityFormula, c.unitCostFormula]) {
          if (!f) continue;
          if (!/^[A-Za-z0-9_.+\-*/%()\s,]*$/.test(f)) return `The formula for “${c.name}” has characters that are not allowed. Use numbers, variables and + − × ÷ ( ).`;
          let depth = 0; for (const ch of f) { if (ch === '(') depth++; if (ch === ')') depth--; if (depth < 0) break; }
          if (depth !== 0) return `Brackets are not balanced in the formula for “${c.name}”.`;
        }
      }
      if (margin === '' || Number(margin) < 0 || Number(margin) >= 100) return 'Profit margin must be between 0 and 99.';
      if (rounding === '' || Number(rounding) <= 0) return 'Rounding amount must be greater than 0.';
      try { const b = JSON.parse(bindingsText); if (!Array.isArray(b)) throw new Error(); } catch { return 'The advanced linked prices box is not valid. Reset it to [].'; }
    }
    return '';
  };
  const next = () => { const m = validate(step); if (m) { setError(m); return; } setError(''); setStep((step + 1) as any); };
  const back = () => { setError(''); setStep((mode === 'create' ? Math.max(1, step - 1) : Math.max(2, step - 1)) as any); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const m = validate(3); if (m) { setError(m); return; }
    setBusy(true); setError('');
    try {
      const inputSchema = { ...sch, fields: inputs.map(i => { const f: any = { ...i.raw, key: i.key, label: i.label.trim(), type: 'number', required: i.required }; if (i.min !== '') f.min = Number(i.min); else delete f.min; return f; }) };
      const formulaConfig = {
        ...cfg, currency: currency || 'LKR', defaultMarginPct: Number(margin) / 100, roundingIncrement: Number(rounding), priceBindings: JSON.parse(bindingsText),
        components: comps.map(c => { const o: any = { ...c.raw, code: c.code || slug(c.name), name: c.name.trim() }; delete o.costFormula; delete o.quantityFormula; delete o.unitCostFormula; if (c.mode === 'direct') o.costFormula = c.costFormula.trim(); else { o.quantityFormula = c.quantityFormula.trim(); o.unitCostFormula = c.unitCostFormula.trim(); } return o; }),
      };
      const row = mode === 'create' ? await api.post('formula-formats', { ...meta, inputSchema, formulaConfig }) : await api.post(`formula-formats/${format.id}/revisions`, { inputSchema, formulaConfig });
      onSaved(row);
    } catch (e2) { setError(err(e2)); } finally { setBusy(false); }
  };

  const stepsList = mode === 'create' ? [1, 2, 3] : [2, 3];
  const stepName: Record<number, string> = { 1: 'Format details', 2: 'Measurements', 3: 'Costs & pricing' };
  return <div className="modal-backdrop"><div className="modal modal-wide">
    <div className="modal-heading"><div><h3>{mode === 'create' ? 'Create costing format' : `New version · ${format?.name}`}</h3><p>{mode === 'create' ? 'Answer a few simple steps. The new format is saved as a draft and is not used anywhere until you make it live.' : 'Change the measurements or cost items. The current live version stays in use until you make this one live.'}</p></div><button className="icon-button" onClick={onClose}>×</button></div>
    <div className="chips" style={{ marginBottom: 14 }}>{stepsList.map((s, idx) => <span key={s} className="chip" style={{ fontWeight: step === s ? 700 : 400, opacity: step === s ? 1 : 0.6 }}>{idx + 1}. {stepName[s]}</span>)}</div>
    <form onSubmit={save}>
      {step === 1 && <div className="form-grid">
        <label className="form-field"><span>Format name *</span><input value={meta.name} onChange={e => setMeta({ ...meta, name: e.target.value, code: meta.code || slug(e.target.value) })} placeholder="Free Standing Panel" /><small>The name your team will see in New costing.</small></label>
        <label className="form-field"><span>Format code *</span><input value={meta.code} onChange={e => setMeta({ ...meta, code: slug(e.target.value) })} placeholder="ENC_FREE_STANDING" /><small>Short unique ID. Filled in automatically from the name.</small></label>
        <label className="form-field"><span>Product family *</span><input value={meta.familyName} onChange={e => setMeta({ ...meta, familyName: e.target.value, familyCode: slug(e.target.value) })} placeholder="Metal Enclosures" /><small>Group this format belongs to.</small></label>
        <label className="form-field"><span>Type</span><select value={meta.surfaceType} onChange={e => setMeta({ ...meta, surfaceType: e.target.value })}><option value="CUSTOM">Custom</option><option value="INDOOR">Indoor</option><option value="OUTDOOR">Outdoor</option><option value="FREE_STANDING">Free Standing</option><option value="SUNK_TYPE">Sunk Type</option></select></label>
      </div>}

      {step === 2 && <>
        <div className="section-header"><div className="section-number">{mode === 'create' ? '02' : '01'}</div><div><h3>Measurements</h3><p>What does the person need to enter when costing this product? Each one becomes a variable you can use in formulas.</p></div></div>
        {inputs.map(i => <div key={i.uid} style={boxStyle}><div style={rowStyle}>
          <label className="form-field" style={{ flex: '2 1 200px' }}><span>Label shown to the user *</span><input value={i.label} onChange={e => { const label = e.target.value; const auto = !i.key || i.key === camelKey(i.label); updInput(i.uid, { label, ...(auto ? { key: camelKey(label) } : {}) }); }} placeholder="Door width (mm)" /></label>
          <label className="form-field" style={{ flex: '1 1 130px' }}><span>Variable name *</span><input value={i.key} onChange={e => updInput(i.uid, { key: e.target.value.replace(/\s/g, '') })} placeholder="doorWidth" /></label>
          <label className="form-field" style={{ flex: '0 1 110px' }}><span>Minimum</span><input type="number" min="0" step="any" value={i.min} onChange={e => updInput(i.uid, { min: e.target.value })} /></label>
          <label className="checkbox-field" style={{ flex: '0 0 auto' }}><input type="checkbox" checked={i.required} onChange={e => updInput(i.uid, { required: e.target.checked })} /><span>Required</span></label>
          <button type="button" className="remove-line" title="Remove" onClick={() => setInputs(old => old.filter(x => x.uid !== i.uid))}><Trash2 size={14} /></button>
        </div></div>)}
        <Btn variant="secondary" onClick={() => setInputs(old => [...old, { uid: uid(), key: '', label: '', required: true, min: '1', raw: { type: 'number' } }])}><Plus size={14} /> Add measurement</Btn>
      </>}

      {step === 3 && <>
        <div className="section-header"><div className="section-number">{mode === 'create' ? '03' : '02'}</div><div><h3>Cost items</h3><p>Add each part of the cost (sheet, paint, labour…). Type the formula, or click the chips to insert variables and symbols.</p></div></div>
        <div style={{ ...boxStyle, background: 'rgba(128,128,128,.06)' }}><b>Variables you can use</b><div className="chips" style={{ marginTop: 8 }}>{variables.length ? variables.map(v => <span className="chip" key={v}><span style={codeStyle}>{v}</span></span>) : <small className="muted">Add measurements in the previous step first.</small>}</div><small className="muted">Example: <span style={codeStyle}>W * H * 2 / 92903 * 140</span> means width × height × 2 sides ÷ 92903 (mm² per sq ft) × rate per sq ft.</small></div>
        {comps.map((c, idx) => <div key={c.uid} style={boxStyle}>
          <div style={rowStyle}>
            <label className="form-field" style={{ flex: '2 1 220px' }}><span>Cost item name *</span><input value={c.name} onChange={e => updComp(c.uid, { name: e.target.value, ...(!c.raw?.code && (!c.code || c.code === slug(c.name)) ? { code: slug(e.target.value) } : {}) })} placeholder="Sheet material" /></label>
            <label className="form-field" style={{ flex: '1 1 180px' }}><span>Calculated as</span><select value={c.mode} onChange={e => updComp(c.uid, { mode: e.target.value as any })}><option value="direct">One formula (total cost)</option><option value="qty">Quantity × Unit cost</option></select></label>
            <button type="button" className="remove-line" title="Remove cost item" onClick={() => setComps(old => old.filter(x => x.uid !== c.uid))}><Trash2 size={14} /></button>
          </div>
          {([c.mode === 'direct' ? ['costFormula', 'Total cost formula (LKR)'] : ['quantityFormula', 'Quantity formula'], ...(c.mode === 'qty' ? [['unitCostFormula', 'Unit cost formula (LKR)']] : [])] as [any, string][]).map(([field, label]) => <div key={field} style={{ marginTop: 10 }}>
            <label className="form-field"><span>{label} *</span><input value={(c as any)[field]} onChange={e => updComp(c.uid, { [field]: e.target.value } as any)} placeholder="e.g. W * H / 92903 * 140" /></label>
            <div className="chips" style={{ marginTop: 6 }}>
              {variables.map(v => <button type="button" className="chip" key={v} onClick={() => append(c.uid, field, v)}>{v}</button>)}
              {['+', '-', '*', '/', '(', ')'].map(op => <button type="button" className="chip" key={op} onClick={() => append(c.uid, field, op)}>{op === '*' ? '×' : op === '/' ? '÷' : op}</button>)}
              <button type="button" className="chip" onClick={() => updComp(c.uid, { [field]: '' } as any)}>Clear</button>
            </div>
          </div>)}
          <small className="muted" style={{ display: 'block', marginTop: 8 }}>Item {idx + 1} · ID: {c.code || slug(c.name) || '—'}</small>
        </div>)}
        <Btn variant="secondary" onClick={() => setComps(old => [...old, { uid: uid(), name: '', code: '', mode: 'direct', costFormula: '', quantityFormula: '', unitCostFormula: '', raw: {} }])}><Plus size={14} /> Add cost item</Btn>

        <div className="section-header section-gap"><div className="section-number">{mode === 'create' ? '04' : '03'}</div><div><h3>Selling price rules</h3><p>How the total cost becomes the selling price.</p></div></div>
        <div className="form-grid">
          <label className="form-field"><span>Profit margin (%) *</span><input type="number" min="0" max="99" step="0.5" value={margin} onChange={e => setMargin(e.target.value)} /><small>Enter 20 for 20%.</small></label>
          <label className="form-field"><span>Round selling price to (LKR) *</span><input type="number" min="0.01" step="any" value={rounding} onChange={e => setRounding(e.target.value)} /><small>Example: 10 rounds up to the next LKR 10.</small></label>
          <label className="form-field"><span>Currency</span><input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} /></label>
        </div>

        <button type="button" className="expand-button" style={{ marginTop: 14 }} onClick={() => setShowBindings(!showBindings)}><div><ShieldCheck size={16} /><span>Advanced: linked prices <small>{bindingKeys.length} linked · for technical users only</small></span></div>{showBindings ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button>
        {showBindings && <div style={boxStyle}><small className="muted">Linked prices pull material, finish or hardware prices from Master Data and make them available as variables. Existing links are kept automatically. Edit only if you know the structure.</small><textarea rows={8} spellCheck={false} value={bindingsText} onChange={e => setBindingsText(e.target.value)} style={{ marginTop: 8, width: '100%' }} /></div>}
      </>}

      <ErrorLine message={error} />
      <div className="modal-actions">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        {step > (mode === 'create' ? 1 : 2) && <Btn variant="secondary" onClick={back}>Back</Btn>}
        {step < 3 ? <Btn onClick={next}>Next</Btn> : <button className="btn" type="submit" disabled={busy}>{busy ? <span className="loading-dots"><i /><i /><i /><i /></span> : <Save size={14} />} Save as draft</button>}
      </div>
    </form>
  </div></div>;
}

export function FormulaFormatsPage() {
  const [rows, setRows] = useState<any[]>([]); const [selected, setSelected] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<null | 'create' | 'revision'>(null); const [viewRevId, setViewRevId] = useState<string>('');
  const [testValues, setTestValues] = useState<Record<string, string>>({}); const [priceDate, setPriceDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<any>(null); const [savedMessage, setSavedMessage] = useState(''); const [savedRecord, setSavedRecord] = useState<any>(null); const [search, setSearch] = useState('');

  const load = useCallback(async () => { setLoading(true); try { setRows(await api.list('formula-formats')); setError(''); } catch (e) { setError(err(e)); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const openFormat = async (id: string) => { try { const d = await api.get(`formula-formats/${id}`); setSelected(d); setResult(null); setSavedMessage(''); setViewRevId(''); } catch (e) { setError(err(e)); } };
  const reload = async (id?: string) => { await load(); const target = id || selected?.id; if (target) await openFormat(target); };

  const revs = useMemo(() => [...(selected?.revisions || [])].sort((a: any, b: any) => b.revision - a.revision), [selected]);
  const published = revs.find((r: any) => r.status === 'PUBLISHED');
  const shown = revs.find((r: any) => r.id === viewRevId) || published || revs[0];
  const testFields: any[] = published?.inputSchema?.fields || [];
  useEffect(() => { setTestValues(old => { const n: Record<string, string> = {}; testFields.forEach(f => { n[f.key] = old[f.key] ?? (f.default !== undefined ? String(f.default) : ''); }); return n; }); }, [published?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const publish = async (revisionId: string) => { if (!selected || !window.confirm('Make this version live? It will appear in New costing → Custom format. Older saved costings are not affected.')) return; setBusy(true); setError(''); try { await api.post(`formula-formats/${selected.id}/revisions/${revisionId}/publish`, {}); await reload(); } catch (e) { setError(err(e)); } finally { setBusy(false); } };
  const runTest = async (e: FormEvent) => {
    e.preventDefault(); if (!published) return;
    for (const f of testFields) { if (f.required !== false && testValues[f.key] === '') { setError(`Please enter ${f.label || f.key}.`); return; } if (f.min !== undefined && testValues[f.key] !== '' && Number(testValues[f.key]) < Number(f.min)) { setError(`${f.label || f.key} must be at least ${f.min}.`); return; } }
    setBusy(true); setError(''); setResult(null); setSavedMessage('');
    try { const body: any = { priceDate }; testFields.forEach(f => { if (testValues[f.key] !== '') body[f.key] = Number(testValues[f.key]); }); setResult(await api.post(`formula-formats/calculate/${published.id}`, body)); } catch (e2) { setError(err(e2)); } finally { setBusy(false); }
  };
  const saveTestResult = async () => { if (!result) return; setBusy(true); setError(''); try { const body = { formatCode: result.templateCode, formatName: result.templateName, inputSnapshot: result.inputs, priceSnapshot: result.priceSnapshot || {}, componentBreakdown: result.components, costTotal: result.totalCost, sellingPrice: result.sellingPrice, calculationVersion: `${result.templateCode}:formula-v${result.formulaRevision}` }; const same = savedRecord && savedRecord.formatCode === body.formatCode; const saved = same ? await api.post(`costing-records/${savedRecord.id}/revisions`, body) : await api.post('costing-records', body); if (!same) setSavedRecord(saved); setSavedMessage(`Saved to Costing history as version ${same ? saved.revision : 1}.`); } catch (e) { setError(err(e)); } finally { setBusy(false); } };

  const filtered = rows.filter(r => `${r.name} ${r.code} ${r.family?.name || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <><Heading eyebrow="MASTER DATA / CALCULATION RULES" title="Formula & costing formats" subtitle="Create your own product formats with their own measurements and cost formulas. No developer needed." action={<Btn onClick={() => setEditor('create')}><Plus size={15} /> New format</Btn>} />
    <div className="info-banner"><ShieldCheck size={18} /><div><b>How this connects to New costing</b><p>The three standard cost sheets (Flat beading, Dicky beading, Sunk type) are built into the system and are not edited here. Use this page for <b>other products</b>. Steps: 1) Create a format and save it as a <b>Draft</b>. 2) Test it below. 3) Click <b>Make live</b>. A live format can then be chosen in <b>New costing → Custom format</b>. Changes always create a new version, so older saved costings never change.</p></div></div>
    <ErrorLine message={error} />
    <div className="extended-grid">
      <section className="card data-card"><div className="data-toolbar"><div className="search-box"><input placeholder="Search formats…" value={search} onChange={e => setSearch(e.target.value)} /></div><Btn variant="secondary" onClick={() => void load()}><RefreshCw size={14} /> Refresh</Btn></div>
        {loading ? <Loading /> : <div className="format-list">{filtered.length ? filtered.map(row => { const live = (row.revisions || []).some((r: any) => r.status === 'PUBLISHED'); return <button key={row.id} className={`format-row ${selected?.id === row.id ? 'active' : ''}`} onClick={() => void openFormat(row.id)}><span className="table-symbol"><ClipboardList size={16} /></span><span className="format-row-main"><b>{row.name}</b><small>{row.code} · {row.family?.name || row.surfaceType}</small><small>Latest version: V{row.revisions?.[0]?.revision ?? '—'} · {live ? 'Has a live version' : 'No live version yet'}</small></span><span className={`status-pill ${live ? 'active' : 'draft'}`}>{live ? 'Live' : 'Draft'}</span></button>; }) : <div className="empty-state"><Boxes size={25} /><b>No custom formats yet</b><span>Click “New format” to create your first one.</span></div>}</div>}
      </section>

      <section className="card data-card format-detail">{selected ? <>
        <div className="panel-title-row"><div><div className="eyebrow">FORMAT DETAILS</div><h3>{selected.name}</h3><p>{selected.code} · {selected.surfaceType}</p></div><Btn variant="secondary" onClick={() => setEditor('revision')}><Plus size={14} /> New version</Btn></div>

        <div className="revision-history"><h4><History size={15} /> Versions</h4>
          {revs.map((r: any) => <div className="revision-row" key={r.id} style={shown?.id === r.id ? { outline: '2px solid rgba(80,120,255,.45)', borderRadius: 10 } : undefined}>
            <div className="revision-number">V{r.revision}</div>
            <div><b>{revStatus(r.status)}</b><small>{r.publishedAt ? `Made live ${fmtDate(r.publishedAt)}` : `Created ${fmtDate(r.createdAt)}`}</small></div>
            <Btn variant="secondary" onClick={() => setViewRevId(r.id)}><Eye size={14} /> View</Btn>
            {r.status === 'DRAFT' && <Btn disabled={busy} onClick={() => void publish(r.id)}><CheckCircle2 size={14} /> Make live</Btn>}
          </div>)}
        </div>

        {shown && <div style={{ marginTop: 16 }}><div className="panel-title-row"><div><h4>Version {shown.revision} · {revStatus(shown.status)}</h4><p>A plain-language summary of this version.</p></div></div><FormulaSummary rev={shown} /></div>}

        <div className="test-area"><h4><Calculator size={15} /> Try it out</h4>
          {published ? <form onSubmit={runTest}>
            <p>Enter sample measurements to see what the live version calculates. Nothing is saved unless you choose to.</p>
            <div className="form-grid">
              {testFields.map(f => <label className="form-field" key={f.key}><span>{f.label || f.key}{f.required !== false && <em> *</em>}</span><input type="number" step="any" min={f.min} value={testValues[f.key] ?? ''} onChange={e => setTestValues(old => ({ ...old, [f.key]: e.target.value }))} /></label>)}
              <label className="form-field"><span>Price date</span><input type="date" value={priceDate} onChange={e => setPriceDate(e.target.value)} /><small>Prices valid on this date are used.</small></label>
            </div>
            <button className="btn" type="submit" disabled={busy}><Calculator size={14} /> Calculate</button>
          </form> : <p>Make a version live to test it.</p>}
          {result && <div className="formula-result">
            <div className="price-hero"><div><span>CALCULATED SELLING PRICE</span><h2>{money(result.sellingPrice)}</h2><small>Total cost {money(result.totalCost)} · Margin {(Number(result.marginPct || 0) * 100).toFixed(1)}%</small></div></div>
            <div className="table-wrap"><table><thead><tr><th>Cost item</th><th>Qty</th><th>Cost</th></tr></thead><tbody>{(result.components || []).map((c: any) => <tr key={c.code}><td>{c.name}</td><td>{c.quantity}</td><td>{money(c.totalCost)}</td></tr>)}</tbody></table></div>
            <div className="result-actions"><Btn onClick={() => void saveTestResult()} disabled={busy}><Save size={14} /> Save to costing history</Btn></div>
            {savedMessage && <span>{savedMessage}</span>}
          </div>}
        </div>
      </> : <div className="empty-state"><ClipboardList size={26} /><b>Select a costing format</b><span>See its versions, what it calculates, and try it out.</span></div>}</section>
    </div>
    {editor === 'create' && <FormulaEditor mode="create" onClose={() => setEditor(null)} onSaved={async row => { setEditor(null); await load(); if (row?.id) await openFormat(row.id); }} />}
    {editor === 'revision' && selected && <FormulaEditor mode="revision" format={selected} baseRev={shown} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await reload(); }} />}
  </>;
}

/* =====================================================================
   NEW COSTING → CUSTOM FORMAT
   Uses the live version of a format created in Formula Management.
   Shown next to the standard cost sheet form inside New costing.
   ===================================================================== */
export function CustomFormatCosting({ onResult, onNavigate }: { onResult: (r: any) => void; onNavigate: (p: any) => void }) {
  const [formats, setFormats] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [formatId, setFormatId] = useState(''); const [detail, setDetail] = useState<any>(null);
  const [values, setValues] = useState<Record<string, string>>({}); const [priceDate, setPriceDate] = useState(new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<any>(null); const [busy, setBusy] = useState(false); const [saveBusy, setSaveBusy] = useState(false); const [savedRecord, setSavedRecord] = useState<any>(null); const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => { (async () => { try { const data = await api.list('formula-formats'); setFormats(data); if (data.length) setFormatId(data[0].id); setError(''); } catch (e) { setError(err(e)); } finally { setLoading(false); } })(); }, []);
  useEffect(() => {
    if (!formatId) { setDetail(null); return; }
    let alive = true;
    api.get(`formula-formats/${formatId}`).then((d: any) => {
      if (!alive) return;
      setDetail(d); setResult(null); setSavedMessage('');
      const nv: Record<string, string> = {};
      (liveRevision(d)?.inputSchema?.fields || []).forEach((f: any) => { nv[f.key] = f.default !== undefined ? String(f.default) : ''; });
      setValues(nv);
    }).catch((e: unknown) => { if (alive) setError(err(e)); });
    return () => { alive = false; };
  }, [formatId]);

  const live = liveRevision(detail);
  const fields: any[] = live?.inputSchema?.fields || [];

  const calculate = async (e: FormEvent) => {
    e.preventDefault(); if (!live || !detail) return;
    for (const f of fields) {
      if (f.required !== false && values[f.key] === '') { setError(`Please enter ${f.label || f.key}.`); return; }
      if (f.min !== undefined && values[f.key] !== '' && Number(values[f.key]) < Number(f.min)) { setError(`${f.label || f.key} must be at least ${f.min}.`); return; }
    }
    setBusy(true); setError(''); setResult(null); setSavedMessage('');
    try {
      const body: any = { priceDate };
      fields.forEach(f => { if (values[f.key] !== '') body[f.key] = Number(values[f.key]); });
      const data = await api.post(`formula-formats/calculate/${live.id}`, body);
      setResult(data);
      const summary = fields.filter(f => values[f.key] !== '').map(f => `${f.label || f.key}: ${values[f.key]}`).join(', ');
      onResult({ templateCode: data.templateCode, templateName: data.templateName, description: `${data.templateName || detail.name}${summary ? ` (${summary})` : ''}`, costsLkr: { sellingPriceRounded: data.sellingPrice, totalCost: data.totalCost } });
    } catch (e2) { setError(err(e2)); } finally { setBusy(false); }
  };

  const saveVersion = async () => {
    if (!result) return; setSaveBusy(true); setError('');
    try {
      const body = { formatCode: result.templateCode, formatName: result.templateName, inputSnapshot: result.inputs, priceSnapshot: result.priceSnapshot || {}, componentBreakdown: result.components, costTotal: result.totalCost, sellingPrice: result.sellingPrice, calculationVersion: `${result.templateCode}:formula-v${result.formulaRevision}` };
      const same = savedRecord && savedRecord.formatCode === body.formatCode;
      const saved = same ? await api.post(`costing-records/${savedRecord.id}/revisions`, body) : await api.post('costing-records', body);
      if (!same) setSavedRecord(saved);
      setSavedMessage(`Saved to Costing history as version ${same ? saved.revision : 1}.`);
    } catch (e) { setError(err(e)); } finally { setSaveBusy(false); }
  };

  const hasFormats = formats.length > 0;
  return <>
    <Heading eyebrow="COSTING ENGINE" title="New costing · custom format" subtitle="Cost a product using a format you created in Formula Management. Only formats with a live version can be calculated." action={<div className="live-badge"><span className="status-dot" /> CUSTOM FORMULA</div>} />
    <ErrorLine message={error} />
    {loading ? <section className="card data-card"><Loading /></section> : !hasFormats ? <section className="card data-card"><div className="empty-state"><ClipboardList size={26} /><b>No custom formats yet</b><span>Create one in Master data → Formula management, make it live, then come back here.</span><Btn onClick={() => onNavigate('formulaFormats')}><Plus size={15} /> Open formula management</Btn></div></section> :
      <div className="costing-layout">
        <form className="card costing-form" onSubmit={calculate}>
          <div className="section-header"><div className="section-number">01</div><div><h3>Choose a format</h3><p>Formats come from Formula management.</p></div></div>
          <div className="form-grid">
            <label className="form-field span-2"><span>Costing format *</span><select required value={formatId} onChange={e => setFormatId(e.target.value)}>{formats.map(f => <option key={f.id} value={f.id}>{f.name} · {f.code}</option>)}</select></label>
          </div>
          {detail && !live && <div className="info-banner" style={{ marginTop: 12 }}><AlertCircle size={18} /><div><b>This format has no live version</b><p>Open Formula management, review the draft and click “Make live”. Then it can be used here.</p><Btn variant="secondary" onClick={() => onNavigate('formulaFormats')}>Open formula management</Btn></div></div>}
          {live && <>
            <div className="section-header section-gap"><div className="section-number">02</div><div><h3>Measurements</h3><p>Version {live.revision} is live. Enter the sizes for this product.</p></div></div>
            <div className="form-grid">
              {fields.map(f => <label className="form-field" key={f.key}><span>{f.label || f.key}{f.required !== false && <em> *</em>}</span><input type="number" step="any" min={f.min} required={f.required !== false} value={values[f.key] ?? ''} onChange={e => setValues(old => ({ ...old, [f.key]: e.target.value }))} />{f.min !== undefined && <small>Minimum {f.min}</small>}</label>)}
              <label className="form-field"><span>Price date</span><input type="date" value={priceDate} onChange={e => setPriceDate(e.target.value)} /><small>Prices valid on this date are used.</small></label>
            </div>
            <div className="costing-submit"><div><ShieldCheck size={16} /><span>Uses the live formula version, so results stay consistent.</span></div><button className="btn" type="submit" disabled={busy}>{busy ? <span className="loading-dots"><i /><i /><i /><i /></span> : <Calculator size={16} />} {busy ? 'Calculating…' : 'Calculate cost'} <ArrowRight size={15} /></button></div>
          </>}
        </form>

        <div className="costing-result-column">{!result ? <section className="card result-empty"><div className="eyebrow">COST BREAKDOWN</div><h3>Your calculation will appear here</h3><p>Choose a format, enter the measurements and click Calculate cost.</p></section> :
          <section className="card result-card">
            <div className="result-card-top"><div><div className="eyebrow">CALCULATION RESULT</div><h3>{result.templateName || detail?.name}</h3><p>{result.templateCode} · formula version {result.formulaRevision}</p></div><button type="button" className="icon-button" onClick={() => setResult(null)} title="Clear result"><X size={17} /></button></div>
            <div className="price-hero"><div><span>ESTIMATED SELLING PRICE</span><h2>{money(result.sellingPrice)}</h2><small>Includes {(Number(result.marginPct || 0) * 100).toFixed(1)}% margin</small></div><div className="price-hero-icon"><CircleDollarSign size={26} /></div></div>
            <div className="result-mini-stats"><div><span>Total cost</span><b>{money(result.totalCost)}</b></div><div><span>Profit</span><b>{money(Number(result.sellingPrice) - Number(result.totalCost))}</b></div><div><span>Cost items</span><b>{(result.components || []).length}</b></div></div>
            <div className="cost-breakdown"><div className="panel-title-row"><div><h4>Cost breakdown</h4><p>Each cost item from the formula</p></div></div>
              {(result.components || []).map((c: any) => <div className="cost-line" key={c.code || c.name}><span>{c.name}{c.quantity !== undefined && c.quantity !== null && Number(c.quantity) !== 1 ? ` × ${Number(c.quantity).toLocaleString()}` : ''}</span><b>{money(c.totalCost)}</b></div>)}
              <div className="cost-line cost-line-total"><span>Total manufacturing cost</span><b>{money(result.totalCost)}</b></div>
            </div>
            <div className="result-actions">
              <Btn variant="secondary" onClick={() => void saveVersion()} disabled={saveBusy}><Save size={15} /> {saveBusy ? 'Saving…' : savedRecord ? 'Save new version' : 'Save costing version'}</Btn>
              <Btn onClick={() => onNavigate('quotations')}><FilePlus2 size={16} /> Create quotation from this result <ArrowRight size={15} /></Btn>
            </div>
            {savedMessage && <p className="fine-print"><CheckCircle2 size={13} /> {savedMessage}</p>}
          </section>}
        </div>
      </div>}
  </>;
}

/* =====================================================================
   INVENTORY (unchanged)
   ===================================================================== */
export function InventoryPage() {
  const [rows, setRows] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [lowOnly, setLowOnly] = useState(false); const [modal, setModal] = useState<'item' | 'movement' | null>(null); const [selected, setSelected] = useState<any>(null); const [busy, setBusy] = useState(false); const [history, setHistory] = useState<any[]>([]);
  const [item, setItem] = useState<any>({ code: '', name: '', category: '', unit: 'each', openingStock: '0', reorderLevel: '0', unitCost: '0', location: '' }); const [move, setMove] = useState<any>({ type: 'RECEIPT', quantity: '1', unitCost: '', reference: '', notes: '' });
  const load = useCallback(async () => { setLoading(true); try { const q = new URLSearchParams(); if (search) q.set('search', search); if (lowOnly) q.set('lowStock', 'true'); const r = await api.list('inventory', q.toString()); setRows(r); setError(''); } catch (e) { setError(err(e)); } finally { setLoading(false); } }, [search, lowOnly]); useEffect(() => { void load(); }, [load]);
  const createItem = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await api.post('inventory', { ...item, openingStock: Number(item.openingStock), reorderLevel: Number(item.reorderLevel), unitCost: Number(item.unitCost) }); setModal(null); await load(); } catch (e) { setError(err(e)); } finally { setBusy(false); } };
  const createMove = async (e: FormEvent) => { e.preventDefault(); if (!selected) return; setBusy(true); try { await api.post(`inventory/${selected.id}/movements`, { ...move, quantity: Number(move.quantity), unitCost: move.unitCost === '' ? undefined : Number(move.unitCost) }); setModal(null); await load(); setHistory(await api.list(`inventory/${selected.id}/movements`)); } catch (e) { setError(err(e)); } finally { setBusy(false); } };
  const openMove = (row: any, type: 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT') => { setSelected(row); setMove({ type, quantity: '1', unitCost: String(row.unitCost ?? ''), reference: '', notes: '' }); setModal('movement'); };
  const openHistory = async (row: any) => { setSelected(row); try { setHistory(await api.list(`inventory/${row.id}/movements`)); } catch (e) { setError(err(e)); } };
  return <><Heading eyebrow="OPERATIONS / STOCK CONTROL" title="Inventory management" subtitle="Manage stock balances, receipts, issues, adjustments, reorder thresholds and a full movement ledger." action={<Btn onClick={() => { setItem({ code: '', name: '', category: '', unit: 'each', openingStock: '0', reorderLevel: '0', unitCost: '0', location: '' }); setModal('item'); }}><Plus size={15} /> New item</Btn>} /><ErrorLine message={error} /><section className="card data-card"><div className="data-toolbar"><div className="search-box"><input placeholder="Search item code or name…" value={search} onChange={e => setSearch(e.target.value)} /></div><label className="checkbox-field"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /><span>Low stock only</span></label><div className="toolbar-right"><span className="count-label">{loading ? 'Loading…' : `${rows.length} items`}</span><Btn variant="secondary" onClick={() => void load()}><RefreshCw size={14} /> Refresh</Btn></div></div>{loading ? <Loading /> : <div className="table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>On hand</th><th>Reorder level</th><th>Unit cost</th><th>Location</th><th>Stock actions</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td><div className="primary-cell"><span className="table-symbol"><Boxes size={15} /></span><div><b>{r.name}</b><small>{r.code} · {r.unit}</small></div></div></td><td>{r.category || '—'}</td><td><b>{Number(r.quantityOnHand).toLocaleString()}</b>{Number(r.quantityOnHand) <= Number(r.reorderLevel) && <span className="low-stock-pill">Low</span>}</td><td>{Number(r.reorderLevel).toLocaleString()}</td><td>{money(r.unitCost)}</td><td>{r.location || '—'}</td><td><div className="row-actions"><button title="Receive stock" onClick={() => openMove(r, 'RECEIPT')}><ArrowDownToLine size={15} /></button><button title="Issue stock" onClick={() => openMove(r, 'ISSUE')}><ArrowUpFromLine size={15} /></button><button title="Adjust stock" onClick={() => openMove(r, 'ADJUSTMENT')}><RefreshCw size={15} /></button><button title="Movement history" onClick={() => void openHistory(r)}><History size={15} /></button></div></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><Boxes size={25} /><b>No inventory items yet</b><span>Add your first stock item to start recording movements.</span></div>}</div>}<div className="table-footer"><span>Inventory is tracked using signed stock movements.</span><span>Issue movements cannot reduce stock below zero.</span></div></section>
    {history.length > 0 && selected && !modal && <section className="card data-card movement-history"><div className="panel-title-row"><div><h3>Movement history · {selected.name}</h3><p>Receipts, issues and adjustments</p></div><Btn variant="secondary" onClick={() => setHistory([])}>Close</Btn></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Quantity change</th><th>Reference</th><th>Notes</th></tr></thead><tbody>{history.map(h => <tr key={h.id}><td>{new Date(h.createdAt).toLocaleString()}</td><td>{h.type}</td><td>{Number(h.quantity) > 0 ? '+' : ''}{Number(h.quantity).toLocaleString()}</td><td>{h.reference || '—'}</td><td>{h.notes || '—'}</td></tr>)}</tbody></table></div></section>}
    {modal && <div className="modal-backdrop"><div className="modal"><div className="modal-heading"><div><h3>{modal === 'item' ? 'Add inventory item' : `${move.type} · ${selected?.name}`}</h3><p>{modal === 'item' ? 'Create a stock master record and optional opening balance.' : 'Record a dated stock movement. Adjustments accept positive or negative quantity changes.'}</p></div><button className="icon-button" onClick={() => setModal(null)}>×</button></div><form onSubmit={modal === 'item' ? createItem : createMove}><div className="form-grid">{(modal === 'item' ? [['code', 'Item code'], ['name', 'Item name'], ['category', 'Category'], ['unit', 'Unit'], ['openingStock', 'Opening stock'], ['reorderLevel', 'Reorder level'], ['unitCost', 'Unit cost (LKR)'], ['location', 'Location']] : [['type', 'Movement type'], ['quantity', 'Quantity'], ['unitCost', 'Unit cost (LKR)'], ['reference', 'Reference'], ['notes', 'Notes']]).map(([k, label]) => <label className="form-field" key={k}><span>{label}</span>{k === 'type' ? <select value={move.type} onChange={e => setMove({ ...move, type: e.target.value })}><option value="RECEIPT">Receipt</option><option value="ISSUE">Issue</option><option value="ADJUSTMENT">Adjustment</option></select> : <input required={['code', 'name', 'quantity'].includes(k)} type={['openingStock', 'reorderLevel', 'unitCost', 'quantity'].includes(k) ? 'number' : 'text'} step="0.0001" value={modal === 'item' ? item[k] : move[k]} onChange={e => modal === 'item' ? setItem({ ...item, [k]: e.target.value }) : setMove({ ...move, [k]: e.target.value })} />}</label>)}</div><div className="modal-actions"><Btn variant="secondary" onClick={() => setModal(null)}>Cancel</Btn><button className="btn" type="submit" disabled={busy}>{busy ? <span className="loading-dots"><i /><i /><i /><i /></span> : <Save size={14} />} Save</button></div></form></div></div>}
  </>;
}

/* =====================================================================
   INVOICES (unchanged)
   ===================================================================== */
export function InvoicesPage() {
  const [rows, setRows] = useState<any[]>([]); const [quotes, setQuotes] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [selected, setSelected] = useState<any>(null); const [busy, setBusy] = useState(false); const [quoteId, setQuoteId] = useState(''); const [showCreate, setShowCreate] = useState(false); const [showRevision, setShowRevision] = useState(false); const [lines, setLines] = useState<any[]>([]); const [tax, setTax] = useState('0'); const [dueAt, setDueAt] = useState('');
  const load = useCallback(async () => { setLoading(true); try { const [r, q] = await Promise.all([api.list('invoices', search ? `search=${encodeURIComponent(search)}` : ''), api.list('quotations', 'status=ACCEPTED&limit=100')]); setRows(r); setQuotes(q); setError(''); if (selected) setSelected(await api.get(`invoices/${selected.id}`)); } catch (e) { setError(err(e)); } finally { setLoading(false); } }, [search]); useEffect(() => { void load(); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { const inv = await api.post(`invoices/from-quotation/${quoteId}`, { tax: Number(tax), dueAt: dueAt || undefined }); setShowCreate(false); setSelected(inv); await load(); } catch (e) { setError(err(e)); } finally { setBusy(false); } };
  const action = async (id: string, action: string) => { setBusy(true); try { await api.post(`invoices/${id}/${action}`, {}); setSelected(await api.get(`invoices/${id}`)); await load(); } catch (e) { setError(err(e)); } finally { setBusy(false); } };
  const openRevision = (invoice: any) => { setSelected(invoice); const rev = invoice.revisions?.[0]; setLines((rev?.lineItems || []).map((x: any) => ({ description: x.description, quantity: String(x.quantity), unitPrice: String(x.unitPrice) }))); setTax(String(rev?.tax ?? 0)); setDueAt(invoice.dueAt ? String(invoice.dueAt).slice(0, 10) : ''); setShowRevision(true); };
  const revise = async (e: FormEvent) => { e.preventDefault(); if (!selected) return; setBusy(true); try { await api.post(`invoices/${selected.id}/revisions`, { lines: lines.map(x => ({ ...x, quantity: Number(x.quantity), unitPrice: Number(x.unitPrice) })), tax: Number(tax), dueAt: dueAt || undefined }); setShowRevision(false); setSelected(await api.get(`invoices/${selected.id}`)); await load(); } catch (e) { setError(err(e)); } finally { setBusy(false); } };
  const pdf = async (id: string) => { try { const blob = await api.invoicePdf(id); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${id}.pdf`; a.click(); URL.revokeObjectURL(url); } catch (e) { setError(err(e)); } };
  return <><Heading eyebrow="SALES / BILLING" title="Invoice management" subtitle="Create invoices from accepted quotations, preserve invoice revisions and track issue/payment status." action={<Btn onClick={() => { setQuoteId(quotes[0]?.id || ''); setTax('0'); setDueAt(''); setShowCreate(true); }}><Plus size={15} /> Create invoice</Btn>} /><ErrorLine message={error} /><section className="card data-card"><div className="data-toolbar"><div className="search-box"><input placeholder="Search invoice number…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="toolbar-right"><span className="count-label">{loading ? 'Loading…' : `${rows.length} invoices`}</span><Btn variant="secondary" onClick={() => void load()}><RefreshCw size={14} /> Refresh</Btn></div></div>{loading ? <Loading /> : <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Quotation</th><th>Status</th><th>Latest revision</th><th>Total</th><th>Actions</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className={selected?.id === r.id ? 'selected-row' : ''}><td><button className="inline-link" onClick={async () => setSelected(await api.get(`invoices/${r.id}`))}><FileText size={14} />{r.invoiceNo}</button><small className="cell-sub">{new Date(r.createdAt).toLocaleDateString()}</small></td><td>{r.quotation?.customer?.name || '—'}</td><td>{r.quotation?.quotationNo || '—'}</td><td><span className="status-pill">{r.status}</span></td><td>V{r.revisions?.[0]?.revision ?? '—'}</td><td><b>{money(r.revisions?.[0]?.total)}</b></td><td><div className="row-actions"><button title="View PDF" onClick={() => void pdf(r.id)}><FileText size={15} /></button><button title="Revise invoice" disabled={['PAID', 'VOID'].includes(r.status)} onClick={async () => openRevision(await api.get(`invoices/${r.id}`))}><History size={15} /></button>{r.status === 'DRAFT' && <button title="Issue" onClick={() => void action(r.id, 'issue')}><Send size={15} /></button>}{['ISSUED', 'PARTIALLY_PAID'].includes(r.status) && <button title="Mark paid" onClick={() => void action(r.id, 'paid')}><CheckCircle2 size={15} /></button>}</div></td></tr>)}</tbody></table>{!rows.length && <div className="empty-state"><FileText size={25} /><b>No invoices yet</b><span>Create an invoice from an accepted quotation.</span></div>}</div>}<div className="table-footer"><span>Invoice revisions are immutable snapshots.</span><span>Issued invoices retain their prior revisions.</span></div></section>
    {selected && !showCreate && !showRevision && <section className="card data-card invoice-detail"><div className="panel-title-row"><div><div className="eyebrow">INVOICE DETAILS</div><h3>{selected.invoiceNo}</h3><p>Linked quotation: {selected.quotation?.quotationNo} · {selected.quotation?.customer?.name || 'Customer'}</p></div><div className="toolbar-right"><Btn variant="secondary" onClick={() => void pdf(selected.id)}><FileText size={14} /> PDF</Btn><Btn variant="secondary" onClick={() => openRevision(selected)} disabled={['PAID', 'VOID'].includes(selected.status)}><History size={14} /> New revision</Btn></div></div><div className="revision-history"><h4><History size={15} /> Revision history</h4>{selected.revisions?.map((r: any) => <div className="revision-row" key={r.id}><div className="revision-number">V{r.revision}</div><div><b>{money(r.total)} · Tax {money(r.tax)}</b><small>{new Date(r.createdAt).toLocaleString()}</small></div></div>)}</div></section>}
    {showCreate && <div className="modal-backdrop"><div className="modal"><div className="modal-heading"><div><h3>Create invoice</h3><p>Invoices can only be created from accepted quotations.</p></div><button className="icon-button" onClick={() => setShowCreate(false)}>×</button></div><form onSubmit={create}><div className="form-grid"><label className="form-field span-2"><span>Accepted quotation *</span><select required value={quoteId} onChange={e => setQuoteId(e.target.value)}><option value="">Select quotation</option>{quotes.map(q => <option key={q.id} value={q.id}>{q.quotationNo} · {q.customer?.name || 'Customer'} · {money(q.revisions?.[0]?.total)}</option>)}</select></label><label className="form-field"><span>Additional tax amount (LKR)</span><input type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /></label><label className="form-field"><span>Due date</span><input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} /></label></div>{!quotes.length && <div className="info-banner"><AlertCircle size={17} /><div><b>No accepted quotations</b><p>Accept a quotation first, then create an invoice from it.</p></div></div>}<div className="modal-actions"><Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn><button className="btn" type="submit" disabled={busy || !quoteId}>{busy ? <span className="loading-dots"><i /><i /><i /><i /></span> : <Plus size={14} />} Create invoice</button></div></form></div></div>}
    {showRevision && selected && <div className="modal-backdrop"><div className="modal modal-wide"><div className="modal-heading"><div><h3>New invoice revision · {selected.invoiceNo}</h3><p>Changing an invoice creates a new revision and returns it to Draft for review before issuing.</p></div><button className="icon-button" onClick={() => setShowRevision(false)}>×</button></div><form onSubmit={revise}><div className="revision-editor">{lines.map((line, i) => <div className="revision-edit-row" key={i}><label className="form-field"><span>Description</span><input required value={line.description} onChange={e => setLines(old => old.map((x, j) => i === j ? { ...x, description: e.target.value } : x))} /></label><label className="form-field"><span>Qty</span><input required type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={e => setLines(old => old.map((x, j) => i === j ? { ...x, quantity: e.target.value } : x))} /></label><label className="form-field"><span>Unit price</span><input required type="number" min="0" step="0.01" value={line.unitPrice} onChange={e => setLines(old => old.map((x, j) => i === j ? { ...x, unitPrice: e.target.value } : x))} /></label><button type="button" className="remove-line" onClick={() => setLines(old => old.filter((_, j) => j !== i))} title="Remove line">×</button></div>)}</div><Btn variant="secondary" onClick={() => setLines(old => [...old, { description: '', quantity: '1', unitPrice: '0' }])}><Plus size={14} /> Add line</Btn><div className="form-grid" style={{ marginTop: 14 }}><label className="form-field"><span>Tax amount (LKR)</span><input type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /></label><label className="form-field"><span>Due date</span><input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} /></label></div><div className="modal-actions"><Btn variant="secondary" onClick={() => setShowRevision(false)}>Cancel</Btn><button className="btn" type="submit" disabled={busy || !lines.length}>{busy ? <span className="loading-dots"><i /><i /><i /><i /></span> : <Save size={14} />} Save revision</button></div></form></div></div>}
  </>;
}

/* =====================================================================
   COSTING HISTORY
   ===================================================================== */
type DescRow = { group: 'general' | 'parts' | 'finish' | 'hardware'; label: string; value: string };

export function CostingHistoryPage() {
  const [rows, setRows] = useState<any[]>([]); const [selected, setSelected] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [search, setSearch] = useState('');
  const [revId, setRevId] = useState(''); const [lookups, setLookups] = useState<any>({}); const [showPrices, setShowPrices] = useState(false); const [showTech, setShowTech] = useState(false);

  useEffect(() => { api.allLookups().then(setLookups).catch(() => setLookups({})); }, []);
  const names = useMemo(() => {
    const m = new Map<string, string>(); const finishByCode = new Map<string, string>();
    (lookups.materials || []).forEach((x: any) => m.set(x.id, `${x.code} · ${x.name}`));
    (lookups.sheetSpecs || []).forEach((x: any) => m.set(x.id, `${x.code} (${x.widthMm} × ${x.heightMm} mm)`));
    (lookups.policies || []).forEach((x: any) => m.set(x.id, x.name));
    (lookups.hardware || []).forEach((x: any) => m.set(x.id, x.name));
    (lookups.suppliers || []).forEach((x: any) => m.set(x.id, x.name));
    (lookups.finishes || []).forEach((x: any) => finishByCode.set(x.code, x.name));
    return { m, finishByCode };
  }, [lookups]);

  const load = useCallback(async () => { setLoading(true); try { setRows(await api.list('costing-records', search ? `search=${encodeURIComponent(search)}` : '')); setError(''); } catch (e) { setError(err(e)); } finally { setLoading(false); } }, [search]);
  useEffect(() => { void load(); }, [load]);
  const open = async (id: string) => { try { const d = await api.get(`costing-records/${id}`); setSelected(d); setRevId(''); setShowPrices(false); setShowTech(false); } catch (e) { setError(err(e)); } };

  const revs = useMemo(() => [...(selected?.revisions || [])].sort((a: any, b: any) => b.revision - a.revision), [selected]);
  const rev = revs.find((r: any) => r.id === revId) || revs[0];
  const prev = rev ? revs.find((r: any) => r.revision < rev.revision) : undefined;

  const describe = useCallback((snap: any): DescRow[] => {
    const out: DescRow[] = []; if (!snap || typeof snap !== 'object') return out;
    Object.entries(snap).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      if (k.startsWith('include') && typeof v === 'boolean') { out.push({ group: 'parts', label: humanize(k.replace(/^include/, '')), value: v ? 'Included' : 'Not included' }); return; }
      if (k === 'finishCodes' && Array.isArray(v)) { v.forEach((c: string) => out.push({ group: 'finish', label: names.finishByCode.get(c) || humanize(c), value: 'Applied' })); return; }
      if (k === 'hardwareItems' && typeof v === 'object') { Object.entries(v as any).forEach(([id, qty]) => { if (Number(qty) > 0) out.push({ group: 'hardware', label: names.m.get(id) || 'Hardware item', value: `× ${qty}` }); }); return; }
      if (typeof v === 'object') { flatten(v, k).forEach(f => out.push({ group: 'general', label: f.label, value: showVal(f.key, f.value) })); return; }
      if (typeof v === 'string' && names.m.has(v)) { out.push({ group: 'general', label: humanize(k), value: names.m.get(v)! }); return; }
      if (['templateCode', 'costingVariant', 'surfaceType'].includes(k)) { out.push({ group: 'general', label: humanize(k), value: String(v).replace(/_/g, ' ') }); return; }
      if (k === 'priceDate') { out.push({ group: 'general', label: 'Price date', value: new Date(String(v)).toLocaleDateString() }); return; }
      out.push({ group: 'general', label: humanize(k), value: showVal(k, v) });
    });
    return out;
  }, [names]);

  const desc = useMemo(() => describe(rev?.inputSnapshot), [rev, describe]);
  const prevDesc = useMemo(() => describe(prev?.inputSnapshot), [prev, describe]);
  const changes = useMemo(() => {
    if (!prev) return [];
    const a = new Map(prevDesc.map(d => [`${d.group}|${d.label}`, d.value])); const b = new Map(desc.map(d => [`${d.group}|${d.label}`, d.value]));
    const keys = new Set([...a.keys(), ...b.keys()]); const res: { label: string; from: string; to: string }[] = [];
    keys.forEach(k => { const x = a.get(k) ?? '—', y = b.get(k) ?? '—'; if (x !== y) res.push({ label: k.split('|')[1], from: x, to: y }); });
    return res;
  }, [desc, prevDesc, prev]);
  const priceRows = useMemo(() => flatten(rev?.priceSnapshot).filter(f => f.value !== null && f.value !== '' && !/(^|\.)(id|.*Id)$/.test(f.key)), [rev]);

  const sellDelta = rev && prev ? Number(rev.sellingPrice) - Number(prev.sellingPrice) : 0;
  const costDelta = rev && prev ? Number(rev.costTotal) - Number(prev.costTotal) : 0;
  const comps: any[] = Array.isArray(rev?.componentBreakdown) ? rev.componentBreakdown : [];
  const group = (g: DescRow['group']) => desc.filter(d => d.group === g);
  const DeltaTag = ({ v }: { v: number }) => v === 0 ? <small className="muted">No change</small> : <small style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{v > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{v > 0 ? '+' : '−'}{money(Math.abs(v))} vs V{prev?.revision}</small>;

  return <><Heading eyebrow="COSTING / VERSION HISTORY" title="Saved costing records" subtitle="Every saved costing is kept exactly as it was calculated: the measurements, prices and cost breakdown. Pick a record to review it or compare versions." /><ErrorLine message={error} />
    <div className="extended-grid">
      <section className="card data-card"><div className="data-toolbar"><div className="search-box"><input placeholder="Search costing number or format…" value={search} onChange={e => setSearch(e.target.value)} /></div><Btn variant="secondary" onClick={() => void load()}><RefreshCw size={14} /> Refresh</Btn></div>
        {loading ? <Loading /> : <div className="format-list">{rows.map(r => <button className={`format-row ${selected?.id === r.id ? 'active' : ''}`} key={r.id} onClick={() => void open(r.id)}><span className="table-symbol"><History size={15} /></span><span className="format-row-main"><b>{r.recordNo}</b><small>{r.formatName}</small><small>{r.revisions?.[0] ? `Version ${r.revisions[0].revision} · ${fmtDate(r.revisions[0].createdAt)}` : 'No versions'}</small></span><b>{money(r.revisions?.[0]?.sellingPrice)}</b></button>)}{!rows.length && <div className="empty-state"><History size={25} /><b>No saved costing records</b><span>Calculate an enclosure and choose “Save costing version” to keep it here.</span></div>}</div>}
      </section>

      <section className="card data-card format-detail">{selected && rev ? <>
        <div className="panel-title-row"><div><div className="eyebrow">COSTING RECORD</div><h3>{selected.recordNo}</h3><p>{selected.formatName}</p></div></div>

        <div className="revision-history"><h4><History size={15} /> Versions <small className="muted">(click to review)</small></h4>
          {revs.map((r: any) => <button type="button" key={r.id} className="revision-row" onClick={() => setRevId(r.id)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', ...(rev.id === r.id ? { outline: '2px solid rgba(80,120,255,.45)', borderRadius: 10 } : {}) }}><div className="revision-number">V{r.revision}</div><div><b>{money(r.sellingPrice)} selling price</b><small>{fmtDate(r.createdAt)}</small></div></button>)}
        </div>

        <div className="price-hero" style={{ marginTop: 16 }}><div><span>SELLING PRICE · VERSION {rev.revision}</span><h2>{money(rev.sellingPrice)}</h2>{prev ? <DeltaTag v={sellDelta} /> : <small>First saved version</small>}</div></div>
        <div className="result-mini-stats">
          <div><span>Total cost</span><b>{money(rev.costTotal)}</b>{prev && <DeltaTag v={costDelta} />}</div>
          <div><span>Profit</span><b>{money(Number(rev.sellingPrice) - Number(rev.costTotal))}</b></div>
          <div><span>Saved on</span><b style={{ fontSize: 13 }}>{fmtDate(rev.createdAt)}</b></div>
        </div>

        {prev && <div style={{ ...boxStyle, marginTop: 14 }}><b>What changed since V{prev.revision}</b>
          {changes.length ? <div className="table-wrap" style={{ marginTop: 8 }}><table><thead><tr><th>Item</th><th>Before</th><th>Now</th></tr></thead><tbody>{changes.map(c => <tr key={c.label}><td>{c.label}</td><td>{c.from}</td><td><b>{c.to}</b></td></tr>)}</tbody></table></div> : <p style={mutedStyle}>The inputs are the same. Any price difference comes from updated prices or rules.</p>}
        </div>}

        <h4 style={{ marginTop: 18 }}>Cost breakdown</h4>
        <div className="table-wrap"><table><thead><tr><th>Cost item</th><th>Size / Qty</th><th>Cost</th></tr></thead><tbody>
          {comps.length ? comps.map((c: any, i: number) => <tr key={c.code || c.name || i}><td>{humanize(String(c.name || c.code || `Component ${i + 1}`).replace(/Mm2$/, ''))}</td><td>{c.areaMm2 !== undefined && c.areaMm2 !== null ? `${Number(c.areaMm2).toLocaleString()} mm²` : c.quantity !== undefined ? Number(c.quantity).toLocaleString() : '—'}</td><td>{c.totalCost !== undefined || c.cost !== undefined ? money(c.totalCost ?? c.cost) : '—'}</td></tr>) : <tr><td colSpan={3} className="empty-cell">No breakdown was saved for this version.</td></tr>}
        </tbody></table></div>

        <h4 style={{ marginTop: 18 }}>What was entered</h4>
        <div style={boxStyle}>
          <div className="table-wrap"><table><tbody>{group('general').map((d, i) => <tr key={i}><td style={{ width: '45%' }}><span className="muted">{d.label}</span></td><td><b>{d.value}</b></td></tr>)}{!group('general').length && <tr><td className="empty-cell">No inputs were saved.</td></tr>}</tbody></table></div>
          {group('parts').length > 0 && <div style={{ marginTop: 10 }}><small className="muted">Parts</small><div className="chips" style={{ marginTop: 6 }}>{group('parts').map((d, i) => <span className="chip" key={i} style={{ opacity: d.value === 'Included' ? 1 : 0.45 }}>{d.label}: {d.value}</span>)}</div></div>}
          {group('finish').length > 0 && <div style={{ marginTop: 10 }}><small className="muted">Finishing</small><div className="chips" style={{ marginTop: 6 }}>{group('finish').map((d, i) => <span className="chip" key={i}>{d.label}</span>)}</div></div>}
          {group('hardware').length > 0 && <div style={{ marginTop: 10 }}><small className="muted">Hardware</small><div className="chips" style={{ marginTop: 6 }}>{group('hardware').map((d, i) => <span className="chip" key={i}>{d.label} {d.value}</span>)}</div></div>}
        </div>

        <button type="button" className="expand-button" onClick={() => setShowPrices(!showPrices)}><div><FileText size={16} /><span>Prices used in this calculation <small>{priceRows.length} details</small></span></div>{showPrices ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button>
        {showPrices && <div style={boxStyle}>{priceRows.length ? <div className="table-wrap"><table><tbody>{priceRows.map(f => <tr key={f.key}><td style={{ width: '55%' }}><span className="muted">{f.label}</span></td><td>{typeof f.value === 'string' && names.m.has(f.value) ? names.m.get(f.value) : showVal(f.key.split('.').pop() || f.key, f.value)}</td></tr>)}</tbody></table></div> : <p style={mutedStyle}>No price details were stored with this version.</p>}</div>}

        <button type="button" className="expand-button" onClick={() => setShowTech(!showTech)}><div><ClipboardList size={16} /><span>Technical copy <small>For support and audit only</small></span></div>{showTech ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button>
        {showTech && <><small className="muted">Calculation version: {rev.calculationVersion || '—'}</small><h4>Saved inputs (raw)</h4><pre className="snapshot-json">{JSON.stringify(rev.inputSnapshot, null, 2)}</pre><h4>Price snapshot (raw)</h4><pre className="snapshot-json">{JSON.stringify(rev.priceSnapshot, null, 2)}</pre></>}
      </> : <div className="empty-state"><History size={26} /><b>Select a saved costing</b><span>You will see the price, cost breakdown, what was entered and what changed between versions.</span></div>}</section>
    </div></>;
}