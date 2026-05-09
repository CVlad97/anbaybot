type Row = Record<string, unknown>;

const STORE_PREFIX = 'anbaybot.local.';

function now() {
  return new Date().toISOString();
}

function uid(prefix = 'local') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultRows(table: string): Row[] {
  if (table === 'settings') {
    return [{
      id: 'local_settings',
      kill_switch: false,
      risk_params: {
        maxTradeSizeEur: 50,
        maxTradesPerDay: 10,
        maxSlippageBps: 300,
        tokenBlacklist: [],
        minLiquidityUsd: 10000,
      },
      payout_threshold_eur: 150,
      updated_at: now(),
    }];
  }

  if (table === 'ai_config') {
    return [{
      id: 'local_ai_config',
      enabled: false,
      risk_tolerance: 'moderate',
      auto_rebalance: false,
      rebalance_interval_hours: 24,
      parameters: { scoring_weight: 0.6, momentum_weight: 0.3, risk_weight: 0.1 },
      last_recommendation: null,
      last_run_at: null,
      created_at: now(),
      updated_at: now(),
    }];
  }

  if (table === 'audit_logs') {
    return [{
      id: uid('audit'),
      event: 'local_demo_started',
      meta: { mode: 'github_pages_demo' },
      created_at: now(),
    }];
  }

  return [];
}

export function readTable(table: string): Row[] {
  if (typeof localStorage === 'undefined') return defaultRows(table);
  const key = STORE_PREFIX + table;
  const raw = localStorage.getItem(key);
  if (!raw) {
    const defaults = defaultRows(table);
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
  try {
    return JSON.parse(raw) as Row[];
  } catch {
    const defaults = defaultRows(table);
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }
}

export function writeTable(table: string, rows: Row[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORE_PREFIX + table, JSON.stringify(rows));
}

export function insertRows(table: string, values: Row | Row[]) {
  const rows = readTable(table);
  const input = Array.isArray(values) ? values : [values];
  const inserted = input.map((row) => ({
    id: row.id ?? uid(table),
    created_at: row.created_at ?? now(),
    updated_at: row.updated_at ?? now(),
    ...row,
  }));
  writeTable(table, [...inserted, ...rows]);
  return inserted;
}

export function addAudit(event: string, meta: Row = {}) {
  return insertRows('audit_logs', { event, meta, created_at: now() });
}

export function updateRows(table: string, patch: Row, filters: Array<(row: Row) => boolean>) {
  const rows = readTable(table);
  const updated = rows.map((row) => (
    filters.every((fn) => fn(row))
      ? { ...row, ...patch, updated_at: patch.updated_at ?? now() }
      : row
  ));
  writeTable(table, updated);
  return updated.filter((row) => filters.every((fn) => fn(row)));
}

export function deleteRows(table: string, filters: Array<(row: Row) => boolean>) {
  const rows = readTable(table);
  const deleted = rows.filter((row) => filters.every((fn) => fn(row)));
  writeTable(table, rows.filter((row) => !filters.every((fn) => fn(row))));
  return deleted;
}

export function upsertRow(table: string, value: Row, conflictKeys: string[] = ['id']) {
  const rows = readTable(table);
  const index = rows.findIndex((row) => conflictKeys.every((key) => row[key] === value[key]));
  const next = {
    id: value.id ?? uid(table),
    created_at: value.created_at ?? now(),
    updated_at: now(),
    ...value,
  };
  if (index >= 0) {
    rows[index] = { ...rows[index], ...next };
  } else {
    rows.unshift(next);
  }
  writeTable(table, rows);
  return next;
}

export function createLocalAction(payload: Row) {
  return insertRows('actions', {
    type: 'ENTRY_PREPARED',
    status: 'PREPARED',
    chain: 'solana',
    strategy_id: 'market_scan_demo',
    payload,
    risk_checks: [
      { rule: 'mode', passed: true, detail: 'Local demo only - no live execution' },
      { rule: 'manual_validation', passed: true, detail: 'Human confirmation required' },
    ],
    created_at: now(),
    updated_at: now(),
  })[0];
}

export function getLocalSettings() {
  return readTable('settings')[0];
}

export function setLocalKillSwitch(kill: boolean) {
  const settings = getLocalSettings();
  updateRows('settings', { kill_switch: kill, updated_at: now() }, [(row) => row.id === settings.id]);
  addAudit(kill ? 'kill_switch_activated' : 'kill_switch_deactivated');
}

export function makeLocalQuery(table: string) {
  return new LocalQuery(table);
}

class LocalQuery implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private operation: 'select' | 'update' | 'delete' = 'select';
  private filters: Array<(row: Row) => boolean> = [];
  private updatePatch: Row = {};
  private limitCount?: number;
  private orderKey?: string;
  private orderAscending = true;
  private single = false;
  private head = false;
  private countMode = false;

  constructor(private readonly table: string) {}

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    void columns;
    this.operation = 'select';
    this.head = Boolean(options?.head);
    this.countMode = Boolean(options?.count);
    return this;
  }

  update(patch: Row) {
    this.operation = 'update';
    this.updatePatch = patch;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  insert(values: Row | Row[]) {
    const data = insertRows(this.table, values);
    return Promise.resolve({ data, error: null });
  }

  upsert(value: Row) {
    const conflictKeys = this.table === 'wallet_balances' ? ['wallet_id', 'token_address'] : ['id'];
    return Promise.resolve({ data: upsertRow(this.table, value, conflictKeys), error: null });
  }

  eq(key: string, value: unknown) {
    this.filters.push((row) => row[key] === value);
    return this;
  }

  gte(key: string, value: unknown) {
    this.filters.push((row) => String(row[key] ?? '') >= String(value));
    return this;
  }

  order(key: string, options?: { ascending?: boolean }) {
    this.orderKey = key;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  maybeSingle() {
    this.single = true;
    return this;
  }

  then<TResult1 = { data: unknown; error: null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    if (this.operation === 'update') {
      return { data: updateRows(this.table, this.updatePatch, this.filters), error: null };
    }

    if (this.operation === 'delete') {
      return { data: deleteRows(this.table, this.filters), error: null };
    }

    let rows = readTable(this.table).filter((row) => this.filters.every((fn) => fn(row)));
    const count = this.countMode ? rows.length : undefined;

    if (this.orderKey) {
      const key = this.orderKey;
      const multiplier = this.orderAscending ? 1 : -1;
      rows = [...rows].sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * multiplier);
    }

    if (this.limitCount !== undefined) rows = rows.slice(0, this.limitCount);
    if (this.head) return { data: null, error: null, count };
    if (this.single) return { data: rows[0] ?? null, error: null, count };
    return { data: rows, error: null, count };
  }
}
