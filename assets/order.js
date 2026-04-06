// ── Config ──────────────────────────────────────────────────────────────────
// TODO: Replace with your actual Supabase anon key
const SUPABASE_URL = 'https://lsoifhwlfpumbotgruhq.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Get from Supabase dashboard > Settings > API

// NOTE: This is Fixxa's Stripe publishable key — replace with PITS Stripe account for production
const STRIPE_PK = 'pk_live_51SdJADGV59Ve7rTUUXNLSw5lUxcMfKiaCuOGiVWMr4y8wIMyPWYpYHCIGq7EAyf51elusdGMlCusT7quiGVRXK1N00GaUhupoH';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const stripe = Stripe(STRIPE_PK);

// ── State ───────────────────────────────────────────────────────────────────
let menuItems = [];
let cart = {}; // { itemId: quantity }
let currentStep = 1;
let orderId = null;
let orderNumber = null;

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadMenu();
  renderMenu();
  renderCart();
  setupCheckoutForm();
});

// ── Menu Loading ────────────────────────────────────────────────────────────
async function loadMenu() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('category')
    .order('price');

  if (error) {
    console.error('Failed to load menu:', error);
    // Fallback: use hardcoded menu
    menuItems = getFallbackMenu();
    return;
  }

  // Check daily inventory
  const today = new Date().toISOString().split('T')[0];
  const { data: inventory } = await supabase
    .from('daily_inventory')
    .select('*')
    .eq('date', today);

  const inventoryMap = {};
  if (inventory) {
    inventory.forEach(inv => {
      inventoryMap[inv.menu_item_id] = inv;
    });
  }

  menuItems = data.map(item => ({
    ...item,
    soldOut: !item.available || (inventoryMap[item.id] && inventoryMap[item.id].quantity_available <= inventoryMap[item.id].quantity_sold),
  }));
}

function getFallbackMenu() {
  return [
    { id: 'cheese-slice', name: 'Cheese Slice', description: 'Housemade tomato sauce, fresh mozzarella', price: 5.00, category: 'slice', soldOut: false },
    { id: 'pepperoni-slice', name: 'Pepperoni Slice', description: 'Sauce, mozz, cupped pepperoni', price: 6.00, category: 'slice', soldOut: false },
    { id: 'cheese-pie', name: 'Cheese Pie (16")', description: 'Housemade tomato sauce, fresh mozzarella', price: 24.00, category: 'pie', soldOut: false },
    { id: 'margherita', name: 'Cayucos Margherita', description: 'San Marzano tomato, fresh mozz, basil', price: 24.00, category: 'pie', soldOut: false },
    { id: 'pepperoni-pie', name: 'Pepperoni Pie', description: 'The one they judge you by', price: 25.00, category: 'pie', soldOut: false },
    { id: 'sausage', name: 'Sausage & Peppers', description: 'Cayucos Sausage Co. meat', price: 25.00, category: 'pie', soldOut: false },
    { id: 'mushroom', name: 'Mushroom & White Sauce', description: 'Mighty Cap mushrooms, garlic cream', price: 25.00, category: 'pie', soldOut: false },
    { id: 'seasonal', name: 'Rotating Seasonal', description: "Ask about today's special", price: 25.00, category: 'pie', soldOut: false },
    { id: 'ranch', name: 'Housemade Ranch', description: 'Dipping sauce', price: 1.00, category: 'extra', soldOut: false },
    { id: 'hot-honey', name: 'Hot Honey', description: 'Drizzle on any pie', price: 1.00, category: 'extra', soldOut: false },
    { id: 'hot-sauce', name: 'Cayucos Hot Sauce', description: 'Local & legendary', price: 1.00, category: 'extra', soldOut: false },
    { id: 'gelato', name: 'Leo Leo Gelato', description: 'Cup of gelato', price: 5.00, category: 'extra', soldOut: false },
  ];
}

// ── Menu Rendering ──────────────────────────────────────────────────────────
function renderMenu() {
  const container = document.getElementById('menu-items');
  const categories = {
    slice: { label: 'Slices', icon: '🍕' },
    pie: { label: '16" Pies', icon: '🫓' },
    extra: { label: 'Extras', icon: '✦' },
  };

  let html = '';
  for (const [cat, info] of Object.entries(categories)) {
    const items = menuItems.filter(i => i.category === cat);
    if (!items.length) continue;

    html += `<div class="mb-8">
      <h3 class="font-display text-navy text-2xl mb-4">${info.icon} ${info.label}</h3>
      <div class="space-y-3">`;

    for (const item of items) {
      const qty = cart[item.id] || 0;
      const soldOut = item.soldOut;

      html += `
        <div class="flex items-center gap-4 p-4 rounded-2xl border ${soldOut ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-navy/10 bg-white'} transition-all">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-sans font-bold text-navy">${item.name}</span>
              ${soldOut ? '<span class="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full uppercase">Sold Out</span>' : ''}
            </div>
            <p class="font-serif text-navy/40 text-sm mt-0.5">${item.description}</p>
          </div>
          <span class="font-sans font-bold text-blue text-lg whitespace-nowrap">$${item.price.toFixed(2)}</span>
          ${soldOut ? '' : `
          <div class="flex items-center gap-2">
            <button onclick="updateCart('${item.id}', -1)" class="w-9 h-9 rounded-full border-2 border-navy/20 text-navy font-bold text-lg flex items-center justify-center hover:bg-navy hover:text-white transition-colors ${qty === 0 ? 'opacity-30 pointer-events-none' : ''}">−</button>
            <span class="font-sans font-bold text-navy w-6 text-center" id="qty-${item.id}">${qty}</span>
            <button onclick="updateCart('${item.id}', 1)" class="w-9 h-9 rounded-full bg-blue text-white font-bold text-lg flex items-center justify-center hover:bg-blue-dark transition-colors">+</button>
          </div>`}
        </div>`;
    }
    html += '</div></div>';
  }

  container.innerHTML = html;
}

// ── Cart ────────────────────────────────────────────────────────────────────
function updateCart(itemId, delta) {
  const current = cart[itemId] || 0;
  const newQty = Math.max(0, current + delta);
  if (newQty === 0) {
    delete cart[itemId];
  } else {
    cart[itemId] = newQty;
  }
  renderMenu();
  renderCart();
}

function getCartItems() {
  return Object.entries(cart).map(([id, qty]) => {
    const item = menuItems.find(i => i.id === id);
    return { ...item, quantity: qty, lineTotal: item.price * qty };
  });
}

function getCartTotal() {
  return getCartItems().reduce((sum, i) => sum + i.lineTotal, 0);
}

function getCartCount() {
  return Object.values(cart).reduce((sum, q) => sum + q, 0);
}

function renderCart() {
  const cartBar = document.getElementById('cart-bar');
  const cartDetail = document.getElementById('cart-detail');
  const count = getCartCount();
  const total = getCartTotal();

  // Sticky bottom bar
  if (count === 0) {
    cartBar.classList.add('translate-y-full');
    cartBar.classList.remove('translate-y-0');
  } else {
    cartBar.classList.remove('translate-y-full');
    cartBar.classList.add('translate-y-0');
  }

  document.getElementById('cart-count').textContent = count;
  document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;

  // Cart detail panel
  const items = getCartItems();
  let html = '';
  for (const item of items) {
    html += `
      <div class="flex justify-between items-center py-2 border-b border-navy/5">
        <div>
          <span class="font-sans font-bold text-navy">${item.quantity}× ${item.name}</span>
        </div>
        <span class="font-sans text-navy">$${item.lineTotal.toFixed(2)}</span>
      </div>`;
  }
  if (items.length) {
    html += `
      <div class="flex justify-between items-center pt-3 mt-1">
        <span class="font-sans font-bold text-navy text-lg">Total</span>
        <span class="font-sans font-bold text-navy text-lg">$${total.toFixed(2)}</span>
      </div>`;
  }
  cartDetail.innerHTML = html;
}

// ── Step Navigation ─────────────────────────────────────────────────────────
function goToStep(step) {
  currentStep = step;
  document.querySelectorAll('[data-step]').forEach(el => {
    el.classList.toggle('hidden', el.dataset.step !== String(step));
  });

  // Update step indicators
  document.querySelectorAll('[data-step-indicator]').forEach(el => {
    const s = parseInt(el.dataset.stepIndicator);
    el.classList.toggle('bg-blue', s <= step);
    el.classList.toggle('text-white', s <= step);
    el.classList.toggle('bg-navy/10', s > step);
    el.classList.toggle('text-navy/40', s > step);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToCheckout() {
  if (getCartCount() === 0) return;
  goToStep(2);
}

// ── Checkout Form ───────────────────────────────────────────────────────────
let cardElement = null;

function setupCheckoutForm() {
  const form = document.getElementById('checkout-form');
  form.addEventListener('submit', handleCheckout);
}

async function handleCheckout(e) {
  e.preventDefault();

  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const email = document.getElementById('customer-email').value.trim();
  const pickupTime = document.getElementById('pickup-time').value;
  const notes = document.getElementById('order-notes').value.trim();

  if (!name) {
    showError('Please enter your name.');
    return;
  }

  const total = getCartTotal();
  const items = getCartItems().map(i => ({
    item_id: i.id,
    name: i.name,
    price: i.price,
    quantity: i.quantity,
  }));

  // Create order in Supabase
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: name,
      customer_phone: phone,
      customer_email: email,
      items: items,
      subtotal: total,
      total: total,
      status: 'pending',
      pickup_time: pickupTime,
      notes: notes,
    })
    .select()
    .single();

  if (orderError) {
    console.error('Order creation failed:', orderError);
    showError('Failed to create order. Please try again.');
    return;
  }

  orderId = order.id;
  orderNumber = order.order_number;

  // Go to payment step
  goToStep(3);
  await setupPayment(total, orderId, email);
}

// ── Payment ─────────────────────────────────────────────────────────────────
async function setupPayment(total, orderId, email) {
  const payBtn = document.getElementById('pay-btn');
  const payError = document.getElementById('pay-error');
  payBtn.disabled = true;
  payBtn.textContent = 'Setting up payment...';

  try {
    // Create payment intent via Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ amount: total, order_id: orderId, customer_email: email }),
    });

    const { clientSecret, error } = await response.json();
    if (error) throw new Error(error);

    // Mount Stripe card element
    const elements = stripe.elements({ clientSecret });
    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');

    paymentElement.on('ready', () => {
      payBtn.disabled = false;
      payBtn.textContent = `Pay $${total.toFixed(2)}`;
    });

    // Handle payment
    payBtn.onclick = async () => {
      payBtn.disabled = true;
      payBtn.textContent = 'Processing...';
      payError.classList.add('hidden');

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href, // Not used for redirect
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        payError.textContent = confirmError.message;
        payError.classList.remove('hidden');
        payBtn.disabled = false;
        payBtn.textContent = `Pay $${total.toFixed(2)}`;
        return;
      }

      // Update order status
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          stripe_payment_intent_id: clientSecret.split('_secret_')[0],
          stripe_payment_status: 'succeeded',
        })
        .eq('id', orderId);

      // Show confirmation
      showConfirmation();
    };
  } catch (err) {
    console.error('Payment setup failed:', err);
    payError.textContent = 'Payment setup failed. Please try again or call us to order.';
    payError.classList.remove('hidden');
    payBtn.textContent = 'Retry';
    payBtn.disabled = false;
    payBtn.onclick = () => setupPayment(total, orderId, email);
  }
}

function showConfirmation() {
  goToStep(4);
  document.getElementById('confirm-order-number').textContent = `#${orderNumber}`;
  document.getElementById('confirm-pickup-time').textContent = document.getElementById('pickup-time').value || 'ASAP';
  document.getElementById('confirm-total').textContent = `$${getCartTotal().toFixed(2)}`;

  // Reset cart
  cart = {};
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function startNewOrder() {
  cart = {};
  orderId = null;
  orderNumber = null;
  renderMenu();
  renderCart();
  goToStep(1);
}
