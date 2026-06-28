import { Transaction, DeletedTransaction, EditHistory } from './types';

interface SpreadsheetSyncPayload {
  action: 'add_tx' | 'edit_tx' | 'delete_tx';
  data: Transaction | any;
  auditEdit?: EditHistory;
  auditDelete?: DeletedTransaction;
}

export async function syncToSpreadsheet(payload: SpreadsheetSyncPayload) {
  try {
    const url = (localStorage.getItem('activeScriptUrl') || '').trim();
    if (!url || url === 'native' || !url.startsWith('https://script.google.com/')) {
      // Quiet ignore if not configured or using default/native setting
      return;
    }

    // Run completely in the background via fetch
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // Prevents CORS preflight OPTIONS requests, speeding it up significantly
      },
      body: JSON.stringify(payload),
    })
    .then(() => {
      console.log(`[Google Sheets Backup] Action '${payload.action}' successfully synced in background.`);
    })
    .catch((err) => {
      console.error('[Google Sheets Backup] Error writing payload in background:', err);
    });
  } catch (error) {
    console.error('[Google Sheets Backup] Critical backup system failure:', error);
  }
}
