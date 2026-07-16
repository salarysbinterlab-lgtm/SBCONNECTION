import { useEffect, useMemo, useState } from 'react';
import {
  Code2,
  Eye,
  Image as ImageIcon,
  Monitor,
  Palette,
  PanelBottom,
  RotateCcw,
  Save,
  Settings2,
  Smartphone,
  Tablet,
  Type,
} from 'lucide-react';
import type { DevPageConfig, DevPreviewMode } from './devPageConfig';
import './dev-editor.css';

type EditableConfig = DevPageConfig;
type TabKey = 'content' | 'colors' | 'layout' | 'images' | 'advanced';

type DevEditorProps = {
  config: EditableConfig;
  previewMode: DevPreviewMode;
  onModeChange: (mode: DevPreviewMode) => void;
  onChange: (config: EditableConfig) => void;
  onReset: () => void;
};

const MODE_ICONS: Record<DevPreviewMode, typeof Monitor> = {
  desktop: Monitor,
  ipad: Tablet,
  tablet: Tablet,
  mobile: Smartphone,
};

function cloneConfig<T>(config: T): T {
  return JSON.parse(JSON.stringify(config));
}

async function saveProjectFiles(config: EditableConfig) {
  const response = await fetch('/__sb_dev_editor/save-config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sb-dev-editor': '1',
    },
    body: JSON.stringify({ config }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status !== 'success') {
    throw new Error(data.message || 'บันทึกไฟล์ไม่สำเร็จ');
  }

  return data;
}

function NumberInput({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value || 0))}
      />
    </label>
  );
}

export default function DevEditor({
  config,
  previewMode,
  onModeChange,
  onChange,
  onReset,
}: DevEditorProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('content');
  const [draft, setDraft] = useState<EditableConfig>(() => cloneConfig(config));
  const [status, setStatus] = useState('DEV EDITOR พร้อมใช้งาน');
  const [dock, setDock] = useState<'right' | 'left'>('right');

  useEffect(() => {
    setDraft(cloneConfig(config));
  }, [config]);

  useEffect(() => {
    document.body.dataset.sbPreviewMode = previewMode;
    document.body.style.setProperty('--sb-preview-width', `${draft.previewModes[previewMode].width}px`);
    document.body.style.setProperty('--sb-preview-height', `${draft.previewModes[previewMode].height}px`);

    return () => {
      delete document.body.dataset.sbPreviewMode;
      document.body.style.removeProperty('--sb-preview-width');
      document.body.style.removeProperty('--sb-preview-height');
    };
  }, [previewMode, draft.previewModes]);

  const modeLabel = useMemo(() => draft.previewModes[previewMode].label, [draft.previewModes, previewMode]);

  function updateDraft(updater: (next: EditableConfig) => void) {
    const next = cloneConfig(draft);
    updater(next);
    setDraft(next);
    onChange(next);
    localStorage.setItem('sb_dev_page_config_preview', JSON.stringify(next));
  }

  async function handleSave() {
    try {
      setStatus('กำลังบันทึกไฟล์ project...');
      await saveProjectFiles(draft);
      setStatus('บันทึกแล้ว: src/dev/devPageConfig.ts');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`บันทึกไม่ได้: ${message}`);
      alert(`Dev save error: ${message}\n\nต้องรันผ่าน npm run dev และ Vite dev plugin เท่านั้น`);
    }
  }

  function handleReset() {
    localStorage.removeItem('sb_dev_page_config_preview');
    onReset();
    setStatus('Reset เป็นค่าในไฟล์แล้ว');
  }

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Type }> = [
    { key: 'content', label: 'Text', icon: Type },
    { key: 'colors', label: 'Colors', icon: Palette },
    { key: 'layout', label: 'Layout', icon: Settings2 },
    { key: 'images', label: 'Images', icon: ImageIcon },
    { key: 'advanced', label: 'Advanced', icon: Code2 },
  ];

  return (
    <>
      <div className="sb-dev-modebar">
        {(Object.keys(draft.previewModes) as DevPreviewMode[]).map((mode) => {
          const Icon = MODE_ICONS[mode];

          return (
            <button
              type="button"
              key={mode}
              className={previewMode === mode ? 'active' : ''}
              onClick={() => onModeChange(mode)}
              title={`${draft.previewModes[mode].width} x ${draft.previewModes[mode].height}`}
            >
              <Icon size={16} />
              {draft.previewModes[mode].label}
            </button>
          );
        })}
        <button
          type="button"
          className="editor-toggle"
          onClick={() => setOpen((v) => !v)}
          title="Open low-code editor"
        >
          <PanelBottom size={16} />
          Edit
        </button>
      </div>

      {open && (
        <aside className={`sb-dev-panel ${dock === 'left' ? 'dock-left' : 'dock-right'}`}>
          <div className="sb-dev-panel-head">
            <div>
              <b>CAREBEAU Dev Low-code</b>
              <span>
                {modeLabel} • {draft.previewModes[previewMode].width}×{draft.previewModes[previewMode].height} • ใช้เฉพาะ npm run dev
              </span>
            </div>
            <div className="sb-dev-head-actions">
              <button type="button" onClick={() => setDock(dock === 'left' ? 'right' : 'left')}>
                ↔
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
          </div>

          <div className="sb-dev-tabs">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={tab === item.key ? 'active' : ''}
                  onClick={() => setTab(item.key)}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {tab === 'content' && (
            <div className="sb-dev-grid">
              <label>
                Ghost text
                <input
                  value={draft.ghostText}
                  onChange={(event) => updateDraft((next) => { next.ghostText = event.target.value; })}
                />
              </label>

              <label>
                Login title
                <input
                  value={draft.loginTitle}
                  onChange={(event) => updateDraft((next) => { next.loginTitle = event.target.value; })}
                />
              </label>

              <label>
                Login subtitle
                <input
                  value={draft.loginSubtitle}
                  onChange={(event) => updateDraft((next) => { next.loginSubtitle = event.target.value; })}
                />
              </label>

              <label className="wide">
                First login note
                <input
                  value={draft.firstLoginNote}
                  onChange={(event) => updateDraft((next) => { next.firstLoginNote = event.target.value; })}
                />
              </label>
            </div>
          )}

          {tab === 'colors' && (
            <div className="sb-dev-colors">
              {draft.images.map((item, index) => (
                <div key={item.label} className="sb-dev-color-row">
                  <b>{item.label}</b>
                  <label>
                    BG
                    <input
                      type="color"
                      value={item.bg}
                      onChange={(event) => updateDraft((next) => { next.images[index].bg = event.target.value; })}
                    />
                  </label>
                  <label>
                    Panel
                    <input
                      type="color"
                      value={item.panel}
                      onChange={(event) => updateDraft((next) => { next.images[index].panel = event.target.value; })}
                    />
                  </label>
                  <code>{item.src}</code>
                </div>
              ))}
            </div>
          )}

          {tab === 'images' && (
            <div className="sb-dev-grid">
              {draft.images.map((item, index) => (
                <label key={index} className="wide">
                  {item.label} image path
                  <input
                    value={item.src}
                    onChange={(event) => updateDraft((next) => { next.images[index].src = event.target.value; })}
                  />
                </label>
              ))}
            </div>
          )}

          {tab === 'layout' && (
            <>
              <div className="sb-dev-section-title">Preview frame size</div>
              <div className="sb-dev-grid">
                <NumberInput
                  label={`${modeLabel} width`}
                  value={draft.previewModes[previewMode].width}
                  min={320}
                  max={2400}
                  onChange={(value) => updateDraft((next) => { next.previewModes[previewMode].width = value; })}
                />
                <NumberInput
                  label={`${modeLabel} height`}
                  value={draft.previewModes[previewMode].height}
                  min={480}
                  max={1800}
                  onChange={(value) => updateDraft((next) => { next.previewModes[previewMode].height = value; })}
                />
              </div>

              <div className="sb-dev-section-title">Current mode layout: {modeLabel}</div>
              <div className="sb-dev-grid">
                <NumberInput
                  label="Ghost top %"
                  value={draft.layout.ghostTopPercent[previewMode]}
                  min={0}
                  max={80}
                  onChange={(value) => updateDraft((next) => { next.layout.ghostTopPercent[previewMode] = value; })}
                />
                <label>
                  Ghost font clamp
                  <input
                    value={draft.layout.ghostFontClamp[previewMode]}
                    onChange={(event) => updateDraft((next) => { next.layout.ghostFontClamp[previewMode] = event.target.value; })}
                  />
                </label>
                <NumberInput
                  label="Login top px"
                  value={draft.layout.login[previewMode].top}
                  min={0}
                  max={900}
                  onChange={(value) => updateDraft((next) => { next.layout.login[previewMode].top = value; })}
                />
                <NumberInput
                  label="Login right px"
                  value={draft.layout.login[previewMode].right}
                  min={0}
                  max={900}
                  onChange={(value) => updateDraft((next) => { next.layout.login[previewMode].right = value; })}
                />
                <NumberInput
                  label="Login width px"
                  value={draft.layout.login[previewMode].width}
                  min={280}
                  max={900}
                  onChange={(value) => updateDraft((next) => { next.layout.login[previewMode].width = value; })}
                />
                <NumberInput
                  label="Center scale"
                  value={draft.layout.carousel.centerScale[previewMode]}
                  min={0.4}
                  max={3}
                  step={0.01}
                  onChange={(value) => updateDraft((next) => { next.layout.carousel.centerScale[previewMode] = value; })}
                />
                <NumberInput
                  label="Center height %"
                  value={draft.layout.carousel.centerHeight[previewMode]}
                  min={10}
                  max={120}
                  onChange={(value) => updateDraft((next) => { next.layout.carousel.centerHeight[previewMode] = value; })}
                />
                <NumberInput
                  label="Center bottom %"
                  value={draft.layout.carousel.centerBottom[previewMode]}
                  min={-20}
                  max={80}
                  onChange={(value) => updateDraft((next) => { next.layout.carousel.centerBottom[previewMode] = value; })}
                />
                <NumberInput
                  label="Side height %"
                  value={draft.layout.carousel.sideHeight[previewMode]}
                  min={5}
                  max={80}
                  onChange={(value) => updateDraft((next) => { next.layout.carousel.sideHeight[previewMode] = value; })}
                />
                <NumberInput
                  label="Side bottom %"
                  value={draft.layout.carousel.sideBottom[previewMode]}
                  min={-20}
                  max={80}
                  onChange={(value) => updateDraft((next) => { next.layout.carousel.sideBottom[previewMode] = value; })}
                />
                <NumberInput
                  label="Left x %"
                  value={draft.layout.carousel.leftX[previewMode]}
                  min={0}
                  max={100}
                  onChange={(value) => updateDraft((next) => { next.layout.carousel.leftX[previewMode] = value; })}
                />
                <NumberInput
                  label="Right x %"
                  value={draft.layout.carousel.rightX[previewMode]}
                  min={0}
                  max={100}
                  onChange={(value) => updateDraft((next) => { next.layout.carousel.rightX[previewMode] = value; })}
                />
              </div>
            </>
          )}

          {tab === 'advanced' && (
            <>
              <div className="sb-dev-grid">
                <NumberInput
                  label="Carousel interval ms"
                  value={draft.carousel.intervalMs}
                  min={800}
                  max={12000}
                  onChange={(value) => updateDraft((next) => { next.carousel.intervalMs = value; })}
                />
                <NumberInput
                  label="Transition ms"
                  value={draft.carousel.transitionMs}
                  min={120}
                  max={2000}
                  onChange={(value) => updateDraft((next) => { next.carousel.transitionMs = value; })}
                />
                <label>
                  Auto rotate
                  <select
                    value={draft.carousel.autoRotate ? 'yes' : 'no'}
                    onChange={(event) => updateDraft((next) => { next.carousel.autoRotate = event.target.value === 'yes'; })}
                  >
                    <option value="yes">yes</option>
                    <option value="no">no</option>
                  </select>
                </label>
              </div>
              <pre className="sb-dev-json">{JSON.stringify(draft, null, 2)}</pre>
            </>
          )}

          <div className="sb-dev-actions">
            <button type="button" className="save" onClick={handleSave}>
              <Save size={16} />
              Save to files
            </button>
            <button type="button" onClick={handleReset}>
              <RotateCcw size={16} />
              Reset
            </button>
            <a href="/__sb_dev_editor/status" target="_blank" rel="noreferrer">
              <Eye size={16} />
              API status
            </a>
          </div>

          <p className="sb-dev-status">{status}</p>
        </aside>
      )}
    </>
  );
}
