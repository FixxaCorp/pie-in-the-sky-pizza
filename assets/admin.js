// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://lsoifhwlfpumbotgruhq.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Get from Supabase dashboard > Settings > API
const ADMIN_PASSWORD = 'pieinthesky2024';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth ────────────────────────────────────────────────────────────────────
let authenticated = false;

function checkAuth() {
  const stored = sessionStorage.getItem('pits_admin');
  if (stored === ADMIN_PASSWORD) {
    authenticated = true;
    showDashboard();
  }
}

function login() {
  const pw = document.getElementById('admin-password').value;
  if (pw === ADMIN_PASSWORD) {
    authenticated = true;
    sessionStorage.setItem('pits_admin', pw);
    showDashboard();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
    setTimeout(() => document.getElementById('login-error').classList.add('hidden'), 3000);
  }
}

function showDashboard() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');
  loadDashboard();
  // Auto-refresh every 30 seconds
  setInterval(loadDashboard, 30000);
}

// ── Dashboard ───────────────────────────────────────────────────────────────
async function loadDashboard() {
  await Promise.all([
    loadKPIs(),
    loadOrders(),
    loadInventory(),
    loadRevenueChart(),
  ]);
}

// ── KPIs ────────────────────────────────────────────────────────────────────
async function loadKPIs() {
  const today = new Date().toISOString().split('T')[0];

  const { data: todayOrders } = await supabase
    .from('orders')
    .select('*')
    .gte('created_at', today + 'T00:00:00')
    .in('status', ['paid', 'preparing', 'ready', 'completed']);

  const orders = todayOrders || [];
  const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
  const count = orders.length;
  const avgOrder = count > 0 ? revenue / count : 0;

  // Most popular item
  const itemCounts = {};
  orders.forEach(o => {
    (o.items || []).forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    });
  });
  const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('kpi-revenue').textContent = `$${revenue.toFixed(2)}`;
  document.getElementById('kpi-orders').textContent = count;
  document.getElementById('kpi-popular').textContent = topItem ? topItem[0] : '—';
  document.getElementById('kpi-avg').textContent = `$${avgOrder.toFixed(2)}`;
}

// ── Live Orders ─────────────────────────────────────────────────────────────
async function loadOrders() {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['paid', 'preparing', 'ready'])
    .order('created_at', { ascending: true });

  const container = document.getElementById('order-queue');
  if (!orders || orders.length === 0) {
    container.innerHTML = '<p class="font-serif text-navy/40 italic text-center py-8">No active orders</p>';
    return;
  }

  container.innerHTML = orders.map(order => {
    const statusColors = {
      paid: 'bg-yellow-100 text-yellow-700',
      preparing: 'bg-blue/10 text-blue',
      ready: 'bg-green-100 text-green-700',
    };
    const statusColor = statusColors[order.status] || 'bg-gray-100 text-gray-600';
    const items = (order.items || []).map(i => `${i.quantity}× ${i.name}`).join(', ');
    const time = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="bg-white rounded-2xl p-5 border border-navy/10 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <span class="font-display text-navy text-xl">#${order.order_number}</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold uppercase ${statusColor}">${order.status}</span>
          </div>
          <span class="font-sans text-navy/40 text-sm">${time}</span>
        </div>
        <p class="font-sans text-navy font-bold">${order.customer_name}</p>
        <p class="font-serif text-navy/50 text-sm mt-1">${items}</p>
        ${order.notes ? `<p class="font-serif italic text-navy/40 text-sm mt-1">Note: ${order.notes}</p>` : ''}
        <p class="font-sans text-navy/40 text-sm mt-1">Pickup: ${order.pickup_time || 'ASAP'}</p>
        <div class="flex gap-2 mt-4">
          ${order.status === 'paid' ? `<button onclick="updateOrderStatus('${order.id}', 'preparing')" class="flex-1 bg-blue text-white font-bold text-sm py-2 rounded-full hover:bg-blue-dark transition-colors">Start Preparing</button>` : ''}
          ${order.status === 'preparing' ? `<button onclick="updateOrderStatus('${order.id}', 'ready')" class="flex-1 bg-green-500 text-white font-bold text-sm py-2 rounded-full hover:bg-green-600 transition-colors">Mark Ready</button>` : ''}
          ${order.status === 'ready' ? `<button onclick="updateOrderStatus('${order.id}', 'completed')" class="flex-1 bg-navy text-white font-bold text-sm py-2 rounded-full hover:bg-navy/80 transition-colors">Complete</button>` : ''}
          <button onclick="updateOrderStatus('${order.id}', 'cancelled')" class="px-4 py-2 border border-red-200 text-red-500 font-bold text-sm rounded-full hover:bg-red-50 transition-colors">Cancel</button>
        </div>
      </div>`;
  }).join('');
}

async function updateOrderStatus(orderId, status) {
  await supabase.from('orders').update({ status }).eq('id', orderId);
  loadOrders();
  loadKPIs();
}

// ── Inventory ───────────────────────────────────────────────────────────────
async function loadInventory() {
  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .order('category')
    .order('name');

  const today = new Date().toISOString().split('T')[0];
  const { data: inventory } = await supabase
    .from('daily_inventory')
    .select('*')
    .eq('date', today);

  const invMap = {};
  if (inventory) {
    inventory.forEach(inv => { invMap[inv.menu_item_id] = inv; });
  }

  const container = document.getElementById('inventory-list');
  if (!items) {
    container.innerHTML = '<p class="text-navy/40 italic">No menu items found</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    const inv = invMap[item.id];
    const available = inv ? inv.quantity_available : 0;
    const sold = inv ? inv.quantity_sold : 0;

    return `
      <div class="flex items-center gap-4 p-4 rounded-xl border border-navy/10 bg-white">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-sans font-bold text-navy">${item.name}</span>
            <span class="font-sans text-navy/30 text-xs">${item.category}</span>
          </div>
          <p class="font-sans text-navy/40 text-sm">${sold} sold today</p>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" ${item.available ? 'checked' : ''} onchange="toggleAvailable('${item.id}', this.checked)" class="w-4 h-4 rounded border-navy/20 text-blue focus:ring-blue cursor-pointer" />
            <span class="font-sans text-sm text-navy/60">Available</span>
          </label>
          <div class="flex items-center gap-2">
            <label class="font-sans text-sm text-navy/40">Qty:</label>
            <input type="number" value="${available}" min="0" max="999"
              onchange="updateInventory('${item.id}', this.value)"
              class="w-16 px-2 py-1 border border-navy/20 rounded-lg text-center font-sans text-navy font-bold focus:outline-none focus:border-blue" />
          </div>
        </div>
      </div>`;
  }).join('');
}

async function toggleAvailable(itemId, available) {
  await supabase.from('menu_items').update({ available }).eq('id', itemId);
}

async function updateInventory(itemId, quantity) {
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('daily_inventory')
    .select('id')
    .eq('menu_item_id', itemId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('daily_inventory')
      .update({ quantity_available: parseInt(quantity) })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('daily_inventory')
      .insert({
        menu_item_id: itemId,
        date: today,
        quantity_available: parseInt(quantity),
        quantity_sold: 0,
      });
  }
}

// ── Revenue Chart ───────────────────────────────────────────────────────────
let revenueChart = null;

async function loadRevenueChart() {
  const days = [];
  const revenues = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    days.push(label);

    const { data: dayOrders } = await supabase
      .from('orders')
      .select('total')
      .gte('created_at', dateStr + 'T00:00:00')
      .lt('created_at', dateStr + 'T23:59:59')
      .in('status', ['paid', 'preparing', 'ready', 'completed']);

    const dayRevenue = (dayOrders || []).reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    revenues.push(dayRevenue);
  }

  const ctx = document.getElementById('revenue-chart').getContext('2d');

  if (revenueChart) {
    revenueChart.data.labels = days;
    revenueChart.data.datasets[0].data = revenues;
    revenueChart.update();
    return;
  }

  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Revenue',
        data: revenues,
        backgroundColor: '#4A6E8B',
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `$${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => `$${v}`,
            font: { family: 'Karla' },
          },
          grid: { color: 'rgba(26,26,46,0.06)' },
        },
        x: {
          ticks: { font: { family: 'Karla', size: 11 } },
          grid: { display: false },
        },
      },
    },
  });
}

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    login();
  });
});
