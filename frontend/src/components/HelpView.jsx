import React, { useState, useMemo } from 'react';
import { faqData } from '../data/faqData';

export default function HelpView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const categories = ['All', ...new Set(faqData.map(f => f.category))];

  const filteredFaqs = useMemo(() => {
    let filtered = faqData;
    if (activeCategory !== 'All') {
      filtered = filtered.filter(faq => faq.category === activeCategory);
    }
    if (searchTerm.trim()) {
      const lowerQuery = searchTerm.toLowerCase();
      filtered = filtered.filter(faq => 
        faq.question.toLowerCase().includes(lowerQuery) || 
        faq.answer.toLowerCase().includes(lowerQuery)
      );
    }
    return filtered;
  }, [searchTerm, activeCategory]);

  const toggleItem = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <main className="flex-1 overflow-auto bg-slate-950 p-8 font-body-md text-on-surface">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center py-10 border-b border-outline-variant">
          <span className="material-symbols-outlined text-neon-pink text-5xl mb-4">support_agent</span>
          <h1 className="text-headline-lg font-headline-lg font-bold text-on-surface mb-2">Knowledge Base</h1>
          <p className="text-on-surface-variant">Search the engine data dictionary or browse common issues.</p>
          
          <div className="mt-8 max-w-xl mx-auto relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-neon-pink">search</span>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search 'convergence failure' or 'LVS mismatch'..." 
              className="w-full bg-surface-container border border-outline-variant py-3 pl-12 pr-4 font-code-sm text-sm focus:border-neon-pink focus:outline-none transition-all shadow-[0_0_0_transparent] focus:shadow-[0_0_15px_rgba(236,72,153,0.3)] text-on-surface rounded-md"
            />
          </div>

          <div className="flex gap-2 justify-center mt-6">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 font-label-caps text-xs rounded-full border transition-all ${
                  activeCategory === cat 
                  ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' 
                  : 'bg-transparent border-outline-variant text-on-surface-variant hover:border-neon-blue/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </header>

        <section className="mb-10">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-headline-md font-headline-md text-neon-blue">
              {searchTerm.trim() || activeCategory !== 'All' ? `Search Results (${filteredFaqs.length})` : 'Frequently Asked Questions'}
            </h2>
          </div>
          
          <div className="space-y-4">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq) => {
                const isOpen = expandedId === faq.id;
                return (
                  <div 
                    key={faq.id} 
                    className={`bg-surface-container border transition-all duration-300 rounded-md overflow-hidden ${isOpen ? 'border-neon-blue shadow-[0_0_10px_rgba(0,240,255,0.1)]' : 'border-outline-variant hover:border-outline-variant/80'}`}
                  >
                    <div 
                      onClick={() => toggleItem(faq.id)}
                      className="p-5 flex justify-between items-center font-bold cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <div className="flex flex-col gap-1 pr-6">
                        <span className="text-[10px] font-label-caps text-neon-blue/80 tracking-widest">{faq.category}</span>
                        <span className="text-on-surface text-[15px]">{faq.question}</span>
                      </div>
                      <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 ${isOpen ? 'rotate-180 text-neon-blue' : 'rotate-0'}`}>
                        expand_more
                      </span>
                    </div>
                    <div 
                      className={`transition-all duration-300 ease-in-out grid ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-5 pb-5 pt-2 text-sm text-on-surface-variant leading-relaxed border-t border-outline-variant/30 mt-2">
                          {faq.answer}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 border border-dashed border-outline-variant rounded-md">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2 opacity-50">search_off</span>
                <p className="text-on-surface-variant font-code-sm text-warning-yellow">// ERR_404: No documentation matches your search term.</p>
                <button 
                  onClick={() => { setSearchTerm(''); setActiveCategory('All'); }} 
                  className="mt-4 text-neon-blue font-label-caps text-xs hover:underline"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
