'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import PremiumIcon from '@/components/primitives/PremiumIcon';

interface TerminalLog {
  text: string;
  type: 'info' | 'success' | 'warn' | 'error' | 'input';
  time: string;
}

export default function OpsCommandTerminal() {
  const [logs, setLogs] = useState<TerminalLog[]>([
    { text: 'Biker Dispatch Command Shell [v2.4.1]', type: 'info', time: 'SYSTEM' },
    { text: 'Type /help to view available dispatcher commands.', type: 'info', time: 'SYSTEM' },
    { text: 'Ops Session Initialized. Live Matchmaking engine triggers active.', type: 'success', time: 'SYSTEM' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (text: string, type: TerminalLog['type'] = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { text, type, time }]);
  };

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmdStr = inputValue.trim();
    if (!cmdStr) return;

    // Add input echo log
    addLog(`ops$ ${cmdStr}`, 'input');
    setInputValue('');

    const tokens = cmdStr.split(/\s+/);
    const command = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    if (command === '/help') {
      addLog('Available commands:', 'info');
      addLog('  /status - View system status, active orders, and available riders.', 'info');
      addLog('  /surge <zone> <multiplier> - Inject/adjust surge rate (e.g. /surge borrowdale 1.9).', 'info');
      addLog('  /tick - Run an manual matchmaking tick cycle.', 'info');
      addLog('  /broadcast <message> - Send a broadcast banner notification to all riders.', 'info');
      addLog('  /clear - Clear the terminal scroll history.', 'info');
      addLog('  /help - View this help menu.', 'info');
      return;
    }

    if (command === '/clear') {
      setLogs([]);
      return;
    }

    const useLiveDb = process.env.NEXT_PUBLIC_USE_LIVE_DB !== 'false';

    if (command === '/status') {
      addLog('Gathering fleet metrics...', 'info');
      if (useLiveDb) {
        try {
          const supabase = createClient();
          const [ordersRes, ridersRes] = await Promise.all([
            supabase.from('delivery_requests').select('status'),
            supabase.from('rider_profiles').select('is_available, kyc_status'),
          ]);

          const activeOrders = ordersRes.data?.filter(o => !['completed', 'cancelled'].includes(o.status)).length || 0;
          const pendingMatching = ordersRes.data?.filter(o => o.status === 'payment_held').length || 0;
          const onlineRiders = ridersRes.data?.filter(r => r.is_available).length || 0;
          const approvedRiders = ridersRes.data?.filter(r => r.kyc_status === 'approved').length || 0;

          addLog('--- FLEET STATUS OVERVIEW ---', 'success');
          addLog(`  Online Available Riders: ${onlineRiders} (Approved: ${approvedRiders})`, 'success');
          addLog(`  Total Active Orders: ${activeOrders}`, 'success');
          addLog(`  Unassigned Orders (Matching): ${pendingMatching}`, 'success');
        } catch (err) {
          addLog('Failed to query remote database status.', 'error');
        }
      } else {
        // Mock offline status
        addLog('--- MOCK FLEET STATUS OVERVIEW ---', 'success');
        addLog('  Online Available Riders: 14 (Approved: 12)', 'success');
        addLog('  Total Active Orders: 8', 'success');
        addLog('  Unassigned Orders (Matching): 3', 'success');
      }
      return;
    }

    if (command === '/surge') {
      if (args.length < 2) {
        addLog('Syntax error: Usage is /surge <borrowdale|cbd|avondale> <multiplier>', 'error');
        return;
      }
      const zone = args[0].toLowerCase();
      const mult = parseFloat(args[1]);

      if (isNaN(mult) || mult < 1.0 || mult > 4.0) {
        addLog('Surge multiplier must be a number between 1.0 and 4.0', 'error');
        return;
      }

      if (!['borrowdale', 'cbd', 'avondale'].includes(zone)) {
        addLog(`Unknown zone: ${zone}. Supported zones: borrowdale, cbd, avondale`, 'warn');
        return;
      }

      addLog(`Injecting surge multipliers: Setting ${zone} to ${mult}x...`, 'info');
      
      // Store surge settings in localStorage so PricingService can read it dynamically!
      localStorage.setItem(`biker_surge_${zone}`, mult.toString());
      
      addLog(`⚡ Surge successfully set: ${zone.toUpperCase()} is now ${mult}x.`, 'success');
      return;
    }

    if (command === '/tick') {
      addLog('🤖 Matchmaking: Running matchmaking tick cycle...', 'info');
      if (useLiveDb) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase.rpc('run_matchmaking_tick');
          if (error) {
            addLog(`❌ Matchmaking tick failed: ${error.message}`, 'error');
          } else {
            addLog(`🟢 Tick complete. Result: ${JSON.stringify(data)}`, 'success');
          }
        } catch (err: any) {
          addLog(`❌ Tick execute error: ${err.message}`, 'error');
        }
      } else {
        addLog('🟢 Mock tick cycle complete. 2 lease offers refreshed.', 'success');
      }
      return;
    }

    if (command === '/broadcast') {
      if (args.length === 0) {
        addLog('Syntax error: Usage is /broadcast <message>', 'error');
        return;
      }
      const msg = args.join(' ');
      addLog(`Broadcasting banner to all active fleets: "${msg}"`, 'info');
      
      if (useLiveDb) {
        try {
          const supabase = createClient();
          const { data: riders } = await supabase.from('rider_profiles').select('user_id');
          if (riders && riders.length > 0) {
            const notifications = riders.map(r => ({
              recipient_id: r.user_id,
              type: 'system',
              title: '📢 System Broadcast',
              body: msg,
              data: {}
            }));
            await supabase.from('notifications').insert(notifications);
            addLog(`Broadcast notification sent to ${riders.length} riders.`, 'success');
          } else {
            addLog('No riders found to notify.', 'warn');
          }
        } catch (err) {
          addLog('Failed to broadcast notifications to database.', 'error');
        }
      } else {
        addLog('Broadcast logged in mock storage.', 'success');
      }
      return;
    }

    // Invalid command
    addLog(`Command not found: "${command}". Type /help to view list.`, 'error');
  };

  return (
    <div 
      style={{
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: '340px',
        width: '100%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        fontFamily: 'Consolas, Monaco, monospace',
        fontSize: '12px',
        color: '#34d399', // Retro green
      }}
    >
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '8px',
          marginBottom: '10px'
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600 }}>
          <PremiumIcon name="Terminal" variant="success" size={16} glow />
          OPS DISPATCH TERMINAL
        </span>
        <span style={{ color: 'rgba(52, 211, 153, 0.5)', fontSize: '10px' }}>
          SECURE SHELL CONNECTION
        </span>
      </div>

      {/* Terminal Log Area */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingRight: '4px',
          marginBottom: '10px',
          lineHeight: '1.4'
        }}
      >
        {logs.map((log, idx) => {
          let color = '#34d399';
          if (log.type === 'success') color = '#10b981';
          else if (log.type === 'warn') color = '#fbbf24';
          else if (log.type === 'error') color = '#ef4444';
          else if (log.type === 'input') color = '#38bdf8';

          return (
            <div key={idx} style={{ color, display: 'flex', gap: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>[{log.time}]</span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{log.text}</span>
            </div>
          );
        })}
        <div ref={logEndRef} />
      </div>

      {/* Terminal Input Form */}
      <form onSubmit={handleCommandSubmit} style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#38bdf8', marginRight: '8px', fontWeight: 700 }}>ops$</span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter shell command..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#38bdf8',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
          autoFocus
        />
      </form>
    </div>
  );
}
