import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export default function DocumentationView() {
  const [docs, setDocs] = useState(null);
  const [activeDoc, setActiveDoc] = useState('getting_started');

  useEffect(() => {
    fetch('/docs_data.json')
      .then(res => res.json())
      .then(data => setDocs(data))
      .catch(err => console.error("Failed to load docs:", err));
  }, []);

  if (!docs) {
    return (
      <main className="flex-1 flex items-center justify-center bg-slate-950 text-on-surface">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-neon-blue text-4xl animate-spin">autorenew</span>
          <div className="animate-pulse text-neon-blue font-label-caps text-xs tracking-widest">LOADING DOCUMENTATION...</div>
        </div>
      </main>
    );
  }

  const renderContent = () => {
    const doc = docs[activeDoc];
    if (!doc) return null;

    return (
      <div className="max-w-4xl">
        <h1 className="text-4xl font-headline-lg font-bold mb-8 text-on-surface">{doc.title}</h1>
        
        {doc.content.split('\n\n').map((paragraph, i) => (
          <p key={i} className="text-on-surface-variant leading-relaxed mb-6 font-body-md whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}

        {doc.code && (
          <div className="mb-8 border border-outline-variant bg-surface-container rounded-sm overflow-hidden">
            <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger-red opacity-50"></span>
              <span className="w-2 h-2 rounded-full bg-warning-yellow opacity-50"></span>
              <span className="w-2 h-2 rounded-full bg-success-green opacity-50"></span>
            </div>
            <SyntaxHighlighter 
              language="python" 
              style={atomDark}
              customStyle={{ margin: 0, padding: '1.5rem', background: 'transparent' }}
              codeTagProps={{ className: 'font-code-sm text-sm' }}
            >
              {doc.code}
            </SyntaxHighlighter>
          </div>
        )}

        {doc.primitives && doc.primitives.length > 0 && (
          <div className="mt-8 border border-outline-variant rounded-sm overflow-hidden">
            <table className="w-full text-left font-body-md text-sm">
              <thead className="bg-surface-container-high border-b border-outline-variant">
                <tr>
                  <th className="p-4 font-label-caps text-xs text-neon-blue w-1/4">SPICE COMMAND</th>
                  <th className="p-4 font-label-caps text-xs text-on-surface-variant">DESCRIPTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant bg-surface-container-low">
                {doc.primitives.map((prim, i) => (
                  <tr key={i} className="hover:bg-surface-variant transition-colors">
                    <td className="p-4 font-code-sm text-neon-purple font-bold">{prim.command}</td>
                    <td className="p-4 text-on-surface-variant leading-relaxed">{prim.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="flex-1 flex overflow-hidden bg-slate-950 font-body-md text-on-surface">
      {/* Sidebar */}
      <aside className="w-64 border-r border-outline-variant bg-surface-container-low overflow-y-auto hidden md:block shrink-0">
        <div className="p-4 border-b border-outline-variant">
          <div className="flex items-center gap-2 text-neon-blue font-bold font-label-caps">
            <span className="material-symbols-outlined">menu_book</span> SYNAPSE DOCS
          </div>
        </div>
        <nav className="p-4 space-y-2">
          {Object.entries(docs).map(([key, doc]) => (
            <button 
              key={key}
              onClick={() => setActiveDoc(key)}
              className={`w-full text-left px-3 py-2 font-label-caps text-xs transition-colors ${
                activeDoc === key 
                  ? 'text-neon-blue bg-primary-container border-l-2 border-neon-blue' 
                  : 'text-on-surface-variant hover:text-white border-l-2 border-transparent'
              }`}
            >
              {doc.title.toUpperCase()}
            </button>
          ))}
        </nav>
      </aside>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_#1e1b4b_0%,_transparent_50%)] opacity-20 pointer-events-none"></div>
        <div className="relative z-10">
          {renderContent()}
        </div>
      </div>
    </main>
  );
}
