import React, { useState } from 'react';

export default function NetlistImporter({ setNodes, setEdges, terminalRef }) {
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (!text.trim()) return;
    setIsImporting(true);
    
    if (terminalRef?.current) {
      terminalRef.current.write(`\x1b[38;5;117m[INFO] Parsing SPICE netlist...\x1b[0m\r\n`);
    }

    try {
      const res = await fetch('http://localhost:8000/api/v1/import/netlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ netlist_text: text })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
      
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;32m[IMPORT SUCCESS] Netlist parsed. Canvas populated.\x1b[0m\r\n`);
      }
    } catch (err) {
      if (terminalRef?.current) {
        terminalRef.current.write(`\x1b[1;31m[ERROR] Import failed: ${err.message}\x1b[0m\r\n`);
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-primary-container border border-slate-800 p-4 relative overflow-hidden mt-4">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-neon-blue text-lg">code_blocks</span>
          <span className="text-label-caps text-xs text-on-surface">NETLIST IMPORT</span>
        </div>
        <textarea
          className="w-full min-h-[150px] bg-slate-900 border border-outline-variant text-on-surface p-3 font-code-sm text-base focus:outline-none focus:border-neon-blue transition-colors mb-3 rounded resize-y"
          placeholder="* Paste SPICE or Verilog netlist here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        <button
          onClick={handleImport}
          disabled={isImporting || !text.trim()}
          className="w-full bg-neon-blue py-2.5 text-black font-label-caps text-xs hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isImporting ? 'IMPORTING...' : 'IMPORT & DRAW CIRCUIT'}
        </button>
      </div>
    </div>
  );
}
