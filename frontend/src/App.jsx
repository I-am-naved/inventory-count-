import { useMemo, useState } from 'react';

const STORAGE_HISTORY = 'protofino-count-history';
const STORAGE_DELIVERY = 'protofino-saved-delivery';

const PRODUCT_CATALOG = [
  { id: 'panaji-naan', name: 'Panaji Naan', qtyPerBox: 8 },
  { id: 'brioche', name: 'Brioche', qtyPerBox: 8 },
  { id: 'sour-dough', name: 'Sour Dough', qtyPerBox: 8 },
  { id: 'pesent', name: 'Pesent', qtyPerBox: 8 },
  { id: 'brownie', name: 'Brownie', qtyPerBox: 6 },
  { id: 'cinnamon-roll', name: 'Cinnamon Roll', qtyPerBox: 6 },
  { id: 'sugar-donut', name: 'Sugar Donut', qtyPerBox: 8 },
  { id: 'cheese-stick', name: 'Cheese Stick', qtyPerBox: 6 },
  { id: 'tortilla', name: 'Tortilla', qtyPerBox: 8 },
  { id: 'banana-loaf', name: 'Banana Loaf', qtyPerBox: 16 },
];

function loadSavedDelivery() {
  try {
    const raw = localStorage.getItem(STORAGE_DELIVERY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function createEmptyRows() {
  const savedDelivery = loadSavedDelivery();
  return PRODUCT_CATALOG.map((product) => ({
    productId: product.id,
    productName: product.name,
    qtyPerBox: product.qtyPerBox,
    shelf: 0,
    worked: 0,
    bsBoxLeft: 0,
    bsLoose: 0,
    delivery: savedDelivery[product.id] ?? 0,
  }));
}

function calculateRowBreakdown(row) {
  const qty = Number(row.qtyPerBox || 0);
  const shelf = Number(row.shelf || 0);
  const worked = Number(row.worked || 0) * qty;
  const bsBoxLeft = Number(row.bsBoxLeft || 0) * qty;
  const bsLoose = Number(row.bsLoose || 0);
  const delivery = Number(row.delivery || 0) * qty;
  const total = shelf + worked + bsBoxLeft - bsLoose + delivery;

  return { shelf, worked, bsBoxLeft, bsLoose, delivery, total };
}

function getDeliverySummary(rows) {
  const items = rows.filter((row) => Number(row.delivery || 0) > 0);
  const productCount = items.length;
  const totalBoxes = items.reduce((sum, row) => sum + Number(row.delivery || 0), 0);
  const totalPieces = items.reduce(
    (sum, row) => sum + Number(row.delivery || 0) * Number(row.qtyPerBox || 0),
    0,
  );

  return { productCount, totalBoxes, totalPieces, items };
}

function getSessionSummary(rows) {
  const grandTotal = rows.reduce((sum, row) => sum + calculateRowBreakdown(row).total, 0);
  const productsCounted = rows.filter((row) => calculateRowBreakdown(row).total > 0).length;
  const delivery = getDeliverySummary(rows);

  return { grandTotal, productsCounted, delivery };
}

function formatSavedDate(isoString) {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isSameDay(date, today)) return `Today at ${time}`;
  if (isSameDay(date, yesterday)) return `Yesterday at ${time}`;
  return date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function hasCountInput(row) {
  return (
    Number(row.shelf || 0) > 0 ||
    Number(row.worked || 0) > 0 ||
    Number(row.bsBoxLeft || 0) > 0 ||
    Number(row.bsLoose || 0) > 0
  );
}

function CountField({ label, hint, value, onChange, subtotal, subtract = false, saved = false }) {
  const subtotalText =
    subtotal != null && subtotal > 0
      ? subtract
        ? `−${subtotal} pcs`
        : `${subtotal} pcs`
      : null;

  return (
    <div className="field-row">
      <div className="field-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
        {saved && <small className="saved-hint">Carried over from last save</small>}
      </div>
      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value || ''}
        placeholder="0"
        onChange={(event) => onChange(event.target.value)}
      />
      {subtotalText && (
        <span className={`field-subtotal${subtract ? ' subtract' : ''}`}>{subtotalText}</span>
      )}
    </div>
  );
}

function SavePanel({ totals, note, setNote, onSave, onClearCount, onResetAll, saveMessage, deliveryItems, isEditing, onCancelEdit }) {
  return (
    <section className="save-panel">
      <div className="save-panel-header">
        <span className="save-icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <h2>Finished counting?</h2>
          <p>Save when you are done for the day. No account or internet needed.</p>
        </div>
      </div>

      <div className="save-preview">
        <h3>Today&apos;s summary</h3>
        <div className="save-preview-stats">
          <div className="preview-stat">
            <span>Total pieces</span>
            <strong>{totals.grandTotal.toLocaleString()}</strong>
          </div>
          <div className="preview-stat">
            <span>Products with count</span>
            <strong>{totals.productsCounted}</strong>
          </div>
        </div>
      </div>

      <div className="save-steps">
        <h3>What happens when you save</h3>
        <ol>
          <li>
            <strong>Your count is stored</strong> on this phone or computer.
          </li>
          <li>
            <strong>Shelf, worked &amp; backstock clear</strong> so you can start fresh tomorrow.
          </li>
          <li>
            <strong>Delivery stays filled in</strong> — you won&apos;t need to enter it again next time.
          </li>
        </ol>
      </div>

      {deliveryItems.length > 0 && (
        <div className="delivery-preview">
          <h3>Delivery kept for next count</h3>
          <ul>
            {deliveryItems.map((row) => (
              <li key={row.productId}>
                <span>{row.productName}</span>
                <span>
                  {row.delivery} box{Number(row.delivery) !== 1 ? 'es' : ''} ({row.delivery * row.qtyPerBox} pcs)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="note-field">
        <span>Add a label (optional)</span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Friday night count"
        />
      </label>

      {isEditing && (
        <div className="save-edit-banner">
          <strong>Editing a saved count</strong>
          <p>Update the numbers and save over the original entry.</p>
        </div>
      )}

      <button type="button" className="save-button" onClick={onSave}>
        {isEditing ? 'Save count' : 'Save count'}
      </button>

      {isEditing && (
        <button type="button" className="secondary save-cancel-button" onClick={onCancelEdit}>
          Cancel edit
        </button>
      )}

      <div className="save-secondary-actions">
        <button type="button" className="secondary" onClick={onClearCount}>
          Clear numbers only
        </button>
        <button type="button" className="secondary text-danger" onClick={onResetAll}>
          Reset everything
        </button>
      </div>

      <p className="save-footnote">Clear numbers only keeps delivery. Reset everything clears delivery too.</p>

      {saveMessage && (
        <div className="save-success" role="status">
          <span className="success-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Count saved!</strong>
            <p>{saveMessage}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function App() {
  const [rows, setRows] = useState(createEmptyRows);
  const [history, setHistory] = useState(loadHistory);
  const [note, setNote] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [editingCountId, setEditingCountId] = useState(null);

  const totals = useMemo(() => getSessionSummary(rows), [rows]);
  const savedDelivery = useMemo(() => loadSavedDelivery(), [history, rows]);
  const deliveryItems = totals.delivery.items;
  const hasActiveCount = rows.some(hasCountInput);

  const updateRow = (index, field, value) => {
    const parsed = value === '' ? 0 : Number(value);
    const newRows = [...rows];
    newRows[index] = {
      ...newRows[index],
      [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    };
    setRows(newRows);
    setSaveMessage('');
  };

  const resetCountFields = () => {
    if (hasActiveCount && !window.confirm('Clear shelf, worked and backstock numbers? Delivery will stay.')) {
      return;
    }
    setRows((current) =>
      current.map((row) => ({
        ...row,
        shelf: 0,
        worked: 0,
        bsBoxLeft: 0,
        bsLoose: 0,
      })),
    );
    setNote('');
    setSaveMessage('');
  };

  const resetAll = () => {
    if (!window.confirm('Reset everything including saved delivery? This cannot be undone.')) {
      return;
    }
    localStorage.removeItem(STORAGE_DELIVERY);
    setRows(
      PRODUCT_CATALOG.map((product) => ({
        productId: product.id,
        productName: product.name,
        qtyPerBox: product.qtyPerBox,
        shelf: 0,
        worked: 0,
        bsBoxLeft: 0,
        bsLoose: 0,
        delivery: 0,
      })),
    );
    setNote('');
    setSaveMessage('');
  };

  const startEditingSavedCount = (item) => {
    const rowMap = new Map((item.rows || []).map((row) => [row.productId, row]));
    const restoredRows = PRODUCT_CATALOG.map((product) => {
      const savedRow = rowMap.get(product.id);

      if (!savedRow) {
        return {
          productId: product.id,
          productName: product.name,
          qtyPerBox: product.qtyPerBox,
          shelf: 0,
          worked: 0,
          bsBoxLeft: 0,
          bsLoose: 0,
          delivery: 0,
        };
      }

      return {
        ...savedRow,
        productName: savedRow.productName || product.name,
        qtyPerBox: Number(savedRow.qtyPerBox || product.qtyPerBox),
        shelf: Number(savedRow.shelf || 0),
        worked: Number(savedRow.worked || 0),
        bsBoxLeft: Number(savedRow.bsBoxLeft || 0),
        bsLoose: Number(savedRow.bsLoose || 0),
        delivery: Number(savedRow.delivery || 0),
      };
    });

    setRows(restoredRows);
    setNote(item.note || '');
    setEditingCountId(item.id);
    setSaveMessage('');
    setExpandedHistory(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditCount = () => {
    setEditingCountId(null);
    setRows(createEmptyRows());
    setNote('');
    setSaveMessage('');
  };

  const saveCount = () => {
    const summary = getSessionSummary(rows);
    const deliveryMap = Object.fromEntries(rows.map((row) => [row.productId, Number(row.delivery || 0)]));

    const entry = {
      id: editingCountId ?? Date.now(),
      savedAt: new Date().toISOString(),
      note: note.trim(),
      summary,
      rows: rows.map((row) => ({
        ...row,
        breakdown: calculateRowBreakdown(row),
      })),
    };

    const updatedHistory = editingCountId
      ? [entry, ...history.filter((item) => item.id !== editingCountId)]
      : [entry, ...history];

    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updatedHistory));
    localStorage.setItem(STORAGE_DELIVERY, JSON.stringify(deliveryMap));

    setHistory(updatedHistory);
    setRows((current) =>
      current.map((row) => ({
        ...row,
        shelf: 0,
        worked: 0,
        bsBoxLeft: 0,
        bsLoose: 0,
        delivery: deliveryMap[row.productId] ?? 0,
      })),
    );
    setNote('');
    setEditingCountId(null);

    const deliveryText =
      summary.delivery.productCount > 0
        ? `${summary.delivery.productCount} delivery item${summary.delivery.productCount !== 1 ? 's' : ''} ready for your next count.`
        : 'Start your next count whenever you are ready.';

    setSaveMessage(editingCountId ? 'Saved changes to your past count.' : deliveryText);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSavedCount = (id) => {
    if (!window.confirm('Delete this saved count?')) return;
    const updatedHistory = history.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updatedHistory));
    setHistory(updatedHistory);
    if (expandedHistory === id) setExpandedHistory(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1>Protofino Inventory</h1>
          <p className="subtitle">Count your stock · saves on this device</p>
        </div>
      </header>

      {saveMessage && (
        <div className="top-toast" role="status">
          <span aria-hidden="true">✓</span>
          <span>Count saved — {saveMessage}</span>
        </div>
      )}

      {deliveryItems.length > 0 && !hasActiveCount && (
        <section className="delivery-banner">
          <div className="banner-icon" aria-hidden="true">
            📦
          </div>
          <div>
            <strong>Delivery already entered</strong>
            <p>
              {totals.delivery.productCount} product{totals.delivery.productCount !== 1 ? 's' : ''},{' '}
              {totals.delivery.totalBoxes} box{totals.delivery.totalBoxes !== 1 ? 'es' : ''},{' '}
              {totals.delivery.totalPieces.toLocaleString()} pieces — ready for today&apos;s count.
            </p>
          </div>
        </section>
      )}

      <section className="summary-bar">
        <div className="summary-card highlight">
          <span className="summary-label">Grand total</span>
          <strong>{totals.grandTotal.toLocaleString()}</strong>
          <small>pieces</small>
        </div>
        <div className="summary-card">
          <span className="summary-label">Products counted</span>
          <strong>{totals.productsCounted}</strong>
          <small>of {PRODUCT_CATALOG.length}</small>
        </div>
      </section>

      <section className="product-list">
        <h2 className="section-title">Enter your counts</h2>
        {rows.map((row, index) => {
          const breakdown = calculateRowBreakdown(row);
          const qty = row.qtyPerBox;
          const deliverySaved = Number(savedDelivery[row.productId] || 0) > 0;

          return (
            <article key={row.productId} className={`product-card${breakdown.total !== 0 ? ' has-count' : ''}`}>
              <div className="product-header">
                <h3>{row.productName}</h3>
                <span className="qty-badge">{qty} per box</span>
              </div>

              <CountField
                label="Shelf"
                hint="Loose pieces on the shelf"
                value={row.shelf}
                onChange={(value) => updateRow(index, 'shelf', value)}
                subtotal={breakdown.shelf}
              />
              <CountField
                label="Worked"
                hint="Number of boxes"
                value={row.worked}
                onChange={(value) => updateRow(index, 'worked', value)}
                subtotal={breakdown.worked}
              />
              <CountField
                label="BS box left"
                hint="Backstock boxes remaining"
                value={row.bsBoxLeft}
                onChange={(value) => updateRow(index, 'bsBoxLeft', value)}
                subtotal={breakdown.bsBoxLeft}
              />
              <CountField
                label="BS loose"
                hint="Subtract loose pieces"
                value={row.bsLoose}
                onChange={(value) => updateRow(index, 'bsLoose', value)}
                subtotal={breakdown.bsLoose}
                subtract
              />
              <CountField
                label="Delivery"
                hint="Delivery boxes received"
                value={row.delivery}
                onChange={(value) => updateRow(index, 'delivery', value)}
                subtotal={breakdown.delivery}
                saved={deliverySaved && Number(row.delivery) > 0}
              />

              <div className="product-total">
                <span>Product total</span>
                <strong>{breakdown.total.toLocaleString()} pcs</strong>
              </div>

              {(breakdown.shelf > 0 ||
                breakdown.worked > 0 ||
                breakdown.bsBoxLeft > 0 ||
                breakdown.bsLoose > 0 ||
                breakdown.delivery > 0) && (
                <p className="breakdown-formula">
                  {breakdown.shelf} + {breakdown.worked} + {breakdown.bsBoxLeft} − {breakdown.bsLoose} +{' '}
                  {breakdown.delivery} = {breakdown.total}
                </p>
              )}
            </article>
          );
        })}
      </section>

      <SavePanel
        totals={totals}
        note={note}
        setNote={setNote}
        onSave={saveCount}
        onClearCount={resetCountFields}
        onResetAll={resetAll}
        saveMessage={saveMessage}
        deliveryItems={deliveryItems}
        isEditing={Boolean(editingCountId)}
        onCancelEdit={cancelEditCount}
      />

      <section className="history-card">
        <h2>Past counts</h2>
        {history.length === 0 ? (
          <div className="empty-history">
            <span className="empty-icon" aria-hidden="true">
              📋
            </span>
            <p>No saved counts yet.</p>
            <small>When you finish counting, tap &quot;Save today&apos;s count&quot; above.</small>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item) => {
              const isOpen = expandedHistory === item.id;
              const deliveryLines = item.rows.filter((row) => Number(row.delivery || 0) > 0);

              return (
                <article key={item.id} className="history-item">
                  <button
                    type="button"
                    className="history-toggle"
                    onClick={() => setExpandedHistory(isOpen ? null : item.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="history-main">
                      <strong>{item.note || 'Inventory count'}</strong>
                      <p className="history-date">{formatSavedDate(item.savedAt)}</p>
                      <div className="history-pills">
                        <span className="pill">{item.summary.grandTotal.toLocaleString()} pcs</span>
                        <span className="pill">{item.summary.productsCounted} products</span>
                        {item.summary.delivery.productCount > 0 && (
                          <span className="pill pill-delivery">
                            {item.summary.delivery.totalBoxes} delivery boxes
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="chevron">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className="history-details">
                      {deliveryLines.length > 0 && (
                        <div className="history-detail-block">
                          <h4>Delivery that day</h4>
                          <ul>
                            {deliveryLines.map((row) => (
                              <li key={row.productId}>
                                {row.productName}: {row.delivery} box{Number(row.delivery) !== 1 ? 'es' : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="history-actions">
                        <button type="button" className="secondary" onClick={() => startEditingSavedCount(item)}>
                          Edit this count
                        </button>
                        <button type="button" className="secondary danger" onClick={() => deleteSavedCount(item.id)}>
                          Delete this count
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
