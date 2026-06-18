import { useState, useEffect } from 'react';

export default function SettingsView({ settings, setSettings }) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [toastMessage, setToastMessage] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const updateLocalSetting = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleVerifyKey = async () => {
    const key = localSettings.apiKey.trim();
    if (!key) return;

    // Client-side format check first
    if (!key.startsWith('sk-') || key.length < 20) {
      setVerifyResult({ valid: false, message: '✗ Invalid format. Key must start with "sk-" and be at least 20 characters.' });
      return;
    }

    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${baseUrl}/api/verify_key?api_key=${encodeURIComponent(key)}`);
      if (!res.ok) {
        setVerifyResult({ valid: false, message: `✗ Server error (${res.status}). Restart backend and retry.` });
        setIsVerifying(false);
        return;
      }
      const data = await res.json();
      if (data.status === 'valid') {
        setVerifyResult({ valid: true, message: '✓ Key verified successfully. Cloud Engine connected.' });
        localStorage.setItem('synapse_api_key', key);
        setSettings(prev => ({ ...prev, apiKey: key }));
      } else {
        setVerifyResult({ valid: false, message: '✗ Key rejected by server. Please check your key.' });
      }
    } catch (e) {
      setVerifyResult({ valid: false, message: '✗ Cannot reach verification server. Restart backend.' });
    }
    setIsVerifying(false);
  };

  const handleSaveConfig = () => {
    if (localSettings.apiKey.length > 0 && localSettings.apiKey.length < 5) {
      setToastMessage({ type: 'error', text: 'API Key must be at least 5 chars' });
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Mass update localStorage
    localStorage.setItem('synapse_hw_accel', localSettings.hardwareAccel);
    localStorage.setItem('default_engine', localSettings.engine);
    localStorage.setItem('synapse_api_key', localSettings.apiKey);
    
    // Apply globally
    setSettings(localSettings);

    setToastMessage({ type: 'success', text: 'Saved Successfully!' });
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <main className="flex-1 overflow-auto bg-slate-950 p-8 font-body-md text-on-surface">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b border-outline-variant pb-4 flex justify-between items-end relative">
          <div>
            <div className="flex items-center gap-3 text-neon-blue mb-2">
              <span className="material-symbols-outlined text-3xl">settings</span>
              <h1 className="text-headline-lg font-headline-lg font-bold text-on-surface">System Preferences</h1>
            </div>
            <p className="text-on-surface-variant font-label-caps text-xs">CONFIGURE GLOBAL COMPILATION AND ENGINE PARAMETERS</p>
          </div>
          <button 
            onClick={handleSaveConfig}
            className={`px-6 py-2 font-label-caps text-xs transition-colors flex items-center gap-2 ${toastMessage?.type === 'success' ? 'bg-success-green text-black' : toastMessage?.type === 'error' ? 'bg-danger-red text-white' : 'bg-neon-blue text-black hover:brightness-110'}`}
          >
            {toastMessage?.type === 'success' ? (
              <><span className="material-symbols-outlined text-sm">done</span> {toastMessage.text}</>
            ) : toastMessage?.type === 'error' ? (
              <><span className="material-symbols-outlined text-sm">error</span> {toastMessage.text}</>
            ) : (
              <><span className="material-symbols-outlined text-sm">save</span> SAVE CONFIG</>
            )}
          </button>
        </header>

        <section className="mb-10 space-y-6">
          <h2 className="text-headline-md font-headline-md flex items-center gap-2 border-b border-outline-variant/30 pb-2">
            <span className="material-symbols-outlined text-sm text-warning-yellow">memory</span> Engine & Acceleration
          </h2>
          
          <div className="bg-surface-container p-6 border border-outline-variant flex items-center justify-between">
            <div>
              <div className="font-bold mb-1">Hardware Acceleration</div>
              <div className="text-xs text-on-surface-variant">Enable CUDA/Metal for faster graph processing.</div>
            </div>
            <div 
              onClick={() => updateLocalSetting('hardwareAccel', !localSettings.hardwareAccel)}
              className={`w-10 h-5 flex items-center px-0.5 border cursor-pointer transition-all ${localSettings.hardwareAccel ? 'bg-neon-blue/20 border-neon-blue justify-end' : 'bg-surface-variant border-outline-variant justify-start'}`}
            >
              <div className={`w-4 h-4 ${localSettings.hardwareAccel ? 'bg-neon-blue' : 'bg-on-surface-variant'}`}></div>
            </div>
          </div>

          <div className="bg-surface-container p-6 border border-outline-variant">
            <div className="font-bold mb-4">Default Compilation Engine</div>
            <select 
              value={localSettings.engine}
              onChange={(e) => updateLocalSetting('engine', e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant text-on-surface p-3 font-code-sm text-sm focus:outline-none focus:border-neon-blue transition-colors appearance-none"
            >
              <option value="SYNAPSE_ANALOG_v3.0">SYNAPSE_ANALOG_v3.0</option>
              <option value="SYNAPSE_DIGITAL_v2.1">SYNAPSE_DIGITAL_v2.1</option>
              <option value="LEGACY_SPICE_v1.0">LEGACY_SPICE_v1.0</option>
            </select>
          </div>
        </section>

        <section className="mb-10 space-y-6">
          <h2 className="text-headline-md font-headline-md flex items-center gap-2 border-b border-outline-variant/30 pb-2">
            <span className="material-symbols-outlined text-sm text-success-green">cloud</span> Cloud Configuration
          </h2>
          <div className="bg-surface-container p-6 border border-outline-variant">
            <div className="font-bold mb-4">Cloud API Key</div>
            <div className="flex gap-2">
              <input 
                type="password" 
                value={localSettings.apiKey}
                onChange={(e) => updateLocalSetting('apiKey', e.target.value)}
                className="flex-1 bg-surface-container-low border border-outline-variant text-on-surface p-3 font-code-sm text-sm focus:outline-none focus:border-neon-blue transition-colors"
                placeholder="sk-..."
              />
              <button
                onClick={handleVerifyKey}
                disabled={isVerifying || !localSettings.apiKey}
                className="px-6 py-3 bg-slate-800 border border-outline-variant hover:bg-slate-700 transition-colors font-label-caps text-xs text-neon-blue flex items-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? 'VERIFYING...' : <><span className="material-symbols-outlined text-sm">verified_user</span> VERIFY KEY</>}
              </button>
            </div>
            <div className="flex justify-between items-center mt-2">
              {verifyResult ? (
                <div className={`text-xs font-code-sm ${verifyResult.valid ? 'text-success-green' : 'text-danger-red'}`}>
                  {verifyResult.message}
                </div>
              ) : (
                <div></div>
              )}
              <div className="text-xs text-on-surface-variant">Verify key to enable Cloud Proxy</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
