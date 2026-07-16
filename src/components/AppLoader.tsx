type AppLoaderProps = {
  visible: boolean;
  color?: string;
  darkMode?: boolean;
  label?: string;
};

export default function AppLoader({
  visible,
  color = '#8b5cf6',
  darkMode = false,
  label = 'Loading data',
}: AppLoaderProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center px-4"
      style={{
        backdropFilter: 'blur(12px)',
        background: darkMode ? 'rgba(2,6,23,0.58)' : 'rgba(248,250,252,0.72)',
      }}
    >
      <div
        className="w-full max-w-xs rounded-2xl border p-5 shadow-2xl sb-loader-card"
        style={{
          background: darkMode ? '#0f172a' : '#ffffff',
          borderColor: darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(148,163,184,0.22)',
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              className="text-[11px] font-black uppercase tracking-widest"
              style={{ color: darkMode ? '#e2e8f0' : '#334155' }}
            >
              {label}
            </p>
            <p className="mt-1 text-[10px] font-bold opacity-50">Preparing workspace 100%</p>
          </div>
          <div className="relative h-10 w-10 shrink-0">
            <span className="absolute inset-0 rounded-full border-4 opacity-20" style={{ borderColor: color }} />
            <span className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: color }} />
            <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: color }} />
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: darkMode ? '#1e293b' : '#e2e8f0' }}>
          <div className="h-full rounded-full sb-loader-progress" style={{ background: color }} />
        </div>
      </div>
    </div>
  );
}
