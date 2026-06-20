import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const Terminal = forwardRef((props, ref) => {
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);

  useImperativeHandle(ref, () => ({
    write: (data) => {
      if (xtermInstance.current) {
        xtermInstance.current.write(data);
      }
    },
    clear: () => {
      if (xtermInstance.current) {
        xtermInstance.current.clear();
      }
    }
  }));

  useEffect(() => {
    const term = new XTerm({
      theme: {
        background: '#131315', 
        foreground: '#e5e2e3', 
        cursor: '#38BDF8',     
        selection: 'rgba(56, 189, 248, 0.3)',
        black: '#000000',
        red: '#F87171',
        green: '#4ADE80',
        yellow: '#FACC15',
        blue: '#38BDF8',
        magenta: '#C084FC',
        cyan: '#7bd0ff',
        white: '#e5e2e3',
      },
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 12,
      cursorBlink: true,
      disableStdin: true,
      scrollback: 1000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    term.write('\x1b[36m[SYSTEM] Synapse v4.0 Terminal Initialized...\x1b[0m\r\n');
    
    // Fit must be called after a slight delay to ensure DOM is ready in flex containers
    setTimeout(() => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0) {
          fitAddon.fit();
        }
      } catch (e) {}
    }, 10);

    xtermInstance.current = term;

    const handleResize = () => {
      try {
        if (terminalRef.current && terminalRef.current.clientWidth > 0) {
          fitAddon.fit();
        }
      } catch (e) {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  return (
    <div className="w-full h-full overflow-hidden p-2" ref={terminalRef}></div>
  );
});

export default Terminal;
