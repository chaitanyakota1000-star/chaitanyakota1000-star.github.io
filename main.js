/* ============================================================
   ShopEase — Global JavaScript (main.js)
   ============================================================ */

// ─── Helpers ────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ─── Theme Management ───────────────────────────────────────
function initTheme() {
  const theme = localStorage.getItem('shopease_theme') || 'light';
  if (theme === 'dark') {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('shopease_theme', isDark ? 'dark' : 'light');
  
  // Update the button icon dynamically if rendered
  const btn = $('.theme-toggle-btn');
  if (btn) {
    btn.innerHTML = isDark ? '☀️' : '🌙';
    btn.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
  
  showToast(`${isDark ? 'Dark Space' : 'Classic Light'} theme enabled!`);
}

// Call theme initialization immediately to prevent layout flashes
initTheme();

// ─── Toast System ───────────────────────────────────────────
function showToast(message, type = 'success') {
  let container = $('#toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.innerHTML = `<span class="toast-icon">${type === 'error' ? '⚠️' : '✅'}</span><span>${message}</span>`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ─── Auth Helpers ───────────────────────────────────────────
function getSession() {
  try { return JSON.parse(localStorage.getItem('shopease_session')); } catch { return null; }
}
function setSession(user) {
  localStorage.setItem('shopease_session', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('shopease_session');
}

// ─── Notifications Store ────────────────────────────────────
function getNotifications() {
  try { return JSON.parse(localStorage.getItem('shopease_notifs')) || []; } catch { return []; }
}
function addNotification(title, body, icon = '🔔', iconColor = 'green') {
  const notifs = getNotifications();
  notifs.unshift({ id: Date.now(), title, body, icon, iconColor, read: false, time: new Date().toLocaleTimeString() });
  if (notifs.length > 30) notifs.length = 30;
  localStorage.setItem('shopease_notifs', JSON.stringify(notifs));
  renderNotifBadge();
}
function markAllRead() {
  const notifs = getNotifications().map(n => ({ ...n, read: true }));
  localStorage.setItem('shopease_notifs', JSON.stringify(notifs));
  renderNotifBadge();
}
function clearNotifications() {
  localStorage.removeItem('shopease_notifs');
  renderNotifBadge();
}
function renderNotifBadge() {
  const badge = $('#notif-badge');
  if (!badge) return;
  const unread = getNotifications().filter(n => !n.read).length;
  badge.textContent = unread;
  badge.style.display = unread > 0 ? 'flex' : 'none';
}

// ─── Cart Helpers ───────────────────────────────────────────
function getCart() {
  try { return JSON.parse(localStorage.getItem('cart')) || []; } catch { return []; }
}
function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  
  // Sync to backend if logged in (only save IDs and quantities)
  const session = getSession();
  if (session && session.email) {
    const minCart = cart.map(item => ({ id: item.id || generateId(item.name), quantity: item.quantity || 1 }));
    fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: session.email, cart: minCart })
    }).catch(e => console.error('Failed to sync cart', e));
  }
}

// ─── Backend Cart Sync ──────────────────────────────────────
async function fetchProductsCache() {
  try {
    const res = await fetch('/api/categories');
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        localStorage.setItem('productsCache', JSON.stringify(json.data));
      }
    }
  } catch(e) {}
}

function getProductsCache() {
  try { return JSON.parse(localStorage.getItem('productsCache')) || []; } catch { return []; }
}

async function syncCartOnLogin() {
  const session = getSession();
  if (!session || !session.email) return;
  try {
    const res = await fetch(`/api/cart?email=${encodeURIComponent(session.email)}`);
    if (!res.ok) return;
    const json = await res.json();
    if (json.success) {
      let localCart = getCart();
      let remoteCartIds = json.cart || [];
      const products = getProductsCache();
      
      // Expand remote IDs back to full objects using cache
      let mergedCart = remoteCartIds.map(remoteItem => {
        const prod = products.find(p => p.id === remoteItem.id);
        if (prod) {
           return { 
             id: prod.id, 
             name: prod.product_name, 
             price: parseInt(prod.price.replace(/[^0-9]/g, '')), 
             quantity: remoteItem.quantity, 
             image: prod.image 
           };
        }
        return null;
      }).filter(i => i);
      
      // Merge local cart into remote cart (like Amazon)
      localCart.forEach(localItem => {
        const localId = localItem.id || generateId(localItem.name);
        const existing = mergedCart.find(i => i.id === localId);
        if (existing) {
          existing.quantity = (existing.quantity || 1) + (localItem.quantity || 1);
        } else {
          localItem.id = localId;
          mergedCart.push(localItem);
        }
      });
      
      localStorage.setItem('cart', JSON.stringify(mergedCart));
      updateCartBadge();
      
      // Save minimal merged cart back to server
      const minCart = mergedCart.map(item => ({ id: item.id, quantity: item.quantity }));
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, cart: minCart })
      });
    }
  } catch(e) {
    console.error('Failed to sync cart on login', e);
  }
}

async function fetchCartOnLoad() {
  const session = getSession();
  if (!session || !session.email) return;
  try {
    const res = await fetch(`/api/cart?email=${encodeURIComponent(session.email)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.cart) {
        const products = getProductsCache();
        let fullCart = json.cart.map(remoteItem => {
           const prod = products.find(p => p.id === remoteItem.id);
           if (prod) {
             return { 
               id: prod.id, 
               name: prod.product_name, 
               price: parseInt(prod.price.replace(/[^0-9]/g, '')), 
               quantity: remoteItem.quantity, 
               image: prod.image 
             };
           }
           return null;
        }).filter(i => i);
        
        localStorage.setItem('cart', JSON.stringify(fullCart));
        updateCartBadge();
        if (document.getElementById('cart-items')) renderPremiumCart();
      }
    }
  } catch(e) {
    console.error('Failed to fetch cart on load', e);
  }
}

function updateCartBadge() {
  const badge = $('#cart-badge');
  if (!badge) return;
  const cart = getCart();
  const count = cart.reduce((s, i) => s + (i.quantity || 1), 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

// ─── Add to Cart (globally used by product pages) ───────────
function addToCart(name, price, imgSrc) {
  const cart = getCart();
  const id = generateId(name);
  if (!imgSrc) {
    try {
      const btn = event.currentTarget || event.target;
      const card = btn.closest('.product-card') || btn.closest('.card') || btn.closest('.smartbox') || btn.closest('.featured-card');
      if (card) {
        const img = card.querySelector('img');
        if (img) imgSrc = img.src;
      }
    } catch(e) {}
  }
  const existing = cart.find(i => (i.id || generateId(i.name)) === id);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({ id, name: name.trim(), price, quantity: 1, image: imgSrc || '' });
  }
  saveCart(cart);
  showToast(`${name.trim()} added to cart!`);
  addNotification('Added to Cart', `${name.trim()} — ₹${price.toLocaleString()}`, '🛒', 'blue');
}

// ─── Search Filter ──────────────────────────────────────────
function initSearch() {
  const input = $('#search');
  if (!input) return;

  // Create a results container if it doesn't exist
  let resultsBox = $('#search-results-box');
  if (!resultsBox) {
    resultsBox = document.createElement('div');
    resultsBox.id = 'search-results-box';
    resultsBox.className = 'search-results-dropdown';
    input.parentNode.appendChild(resultsBox);
  }

  let timeout = null;
  input.addEventListener('input', () => {
    clearTimeout(timeout);
    const qRaw = input.value.trim();
    const qLower = qRaw.toLowerCase();
    
    // 1. Instantly filter any product cards on the current page
    const cards = $$('.product-card, .card, .smartbox, .featured-card');
    if (cards.length > 0) {
      cards.forEach(c => {
        const text = c.textContent.toLowerCase();
        c.style.display = text.includes(qLower) ? '' : 'none';
      });
    }

    if (!qRaw) {
      resultsBox.style.display = 'none';
      return;
    }
    
    // 2. Fetch and show dropdown results from backend
    timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(qRaw)}`);
        if (!res.ok) throw new Error('Network error');
        const json = await res.json();
        
        if (json.success && json.data.length > 0) {
          resultsBox.innerHTML = json.data.map(item => `
            <div class="search-result-item" onclick="addToCart('${item.product_name}', ${item.price.replace(/[^0-9]/g, '')}); document.getElementById('search').value=''; document.getElementById('search-results-box').style.display='none';">
              <span class="search-item-name">${item.product_name}</span>
              <span class="search-item-price">${item.price}</span>
              <span class="search-item-cat">${item.category}</span>
            </div>
          `).join('');
          resultsBox.style.display = 'block';
        } else {
          resultsBox.innerHTML = '<div class="search-result-empty">No products found</div>';
          resultsBox.style.display = 'block';
        }
      } catch (err) {
        console.error(err);
      }
    }, 300); // 300ms debounce
  });
  
  // Hide on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-search')) {
      if (resultsBox) resultsBox.style.display = 'none';
    }
  });
}

// ─── Render Navbar ──────────────────────────────────────────
function renderNavbar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const session = getSession();
  const isDark = document.body.classList.contains('dark');

  container.innerHTML = `
    <nav class="navbar" id="main-navbar">
      <a href="experiment1on_capstone.html" class="nav-logo">
        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQXe3wDOXgE9lJNzS8wYVSnR4AyEhLAur7-HA&s" alt="Logo">
        <span>ShopEase</span>
      </a>

      <div class="nav-search">
        <span class="search-icon">🔍</span>
        <input type="text" id="search" placeholder="Search for products, brands and more…" autocomplete="off">
      </div>

      <div class="nav-actions">
        <!-- Theme Toggle -->
        <button class="theme-toggle-btn" onclick="toggleTheme()" title="${isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}">
          ${isDark ? '☀️' : '🌙'}
        </button>

        <!-- Notifications -->
        <div class="dropdown-wrapper" id="notif-wrapper">
          <button class="nav-btn" onclick="toggleDropdown('notif-dropdown')" title="Notifications">
            🔔 <span class="nav-label">Alerts</span>
            <span class="badge badge-green" id="notif-badge" style="display:none">0</span>
          </button>
          <div class="dropdown-panel" id="notif-dropdown">
            <div class="dropdown-header">
              Notifications
              <button class="clear-btn" onclick="clearNotifications(); renderNotifPanel();">Clear All</button>
            </div>
            <div id="notif-list"></div>
          </div>
        </div>

        <!-- Cart -->
        <a href="cart.html" title="Cart">
          🛒 <span class="nav-label">Cart</span>
          <span class="badge badge-red" id="cart-badge" style="display:none">0</span>
        </a>

        <!-- Account -->
        <div class="dropdown-wrapper" id="account-wrapper">
          <button class="nav-btn" onclick="toggleDropdown('account-dropdown')">
            ${session
              ? `<span class="user-avatar">${session.name.charAt(0).toUpperCase()}</span>`
              : '👤'}
            <span class="nav-label">${session ? session.name : 'Account'}</span>
          </button>
          <div class="dropdown-panel" id="account-dropdown">
            ${session
              ? `
                <div class="dropdown-header">Hi, ${session.name}! 👋</div>
                <button class="profile-menu-item" onclick="window.location.href='cart.html'">🛒 My Cart</button>
                <button class="profile-menu-item" onclick="window.location.href='contactus.html'">📞 Contact Us</button>
                <button class="profile-menu-item danger" onclick="logoutUser()">🚪 Logout</button>
              `
              : `
                <div class="dropdown-header">Welcome!</div>
                <button class="profile-menu-item" onclick="window.location.href='login.html'">🔑 Login</button>
                <button class="profile-menu-item" onclick="window.location.href='signuppage.html'">✨ Sign Up</button>
              `
            }
          </div>
        </div>
      </div>
    </nav>
  `;

  updateCartBadge();
  renderNotifBadge();
  renderNotifPanel();
  initSearch();

  // Seed welcome notifications on first load
  if (getNotifications().length === 0) {
    addNotification('Welcome to ShopEase! 🎉', 'Explore amazing deals and save big.', '🎉', 'gold');
    addNotification('Flash Sale Live! ⚡', 'Up to 65% off on Fashion & Electronics.', '⚡', 'green');
    renderNotifPanel();
  }
}

function renderNotifPanel() {
  const list = $('#notif-list');
  if (!list) return;
  const notifs = getNotifications();
  if (notifs.length === 0) {
    list.innerHTML = '<div class="dropdown-empty">No notifications yet</div>';
    return;
  }
  list.innerHTML = notifs.map(n => `
    <div class="dropdown-item ${n.read ? '' : 'unread'}">
      <div class="notif-icon ${n.iconColor}">${n.icon}</div>
      <div class="notif-body">
        <strong>${n.title}</strong>
        <span>${n.body}</span>
      </div>
    </div>
  `).join('');
}

function toggleDropdown(id) {
  const panel = document.getElementById(id);
  $$('.dropdown-panel').forEach(p => { if (p.id !== id) p.classList.remove('show'); });
  panel.classList.toggle('show');
  if (id === 'notif-dropdown' && panel.classList.contains('show')) {
    markAllRead();
    renderNotifPanel();
  }
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown-wrapper') && !e.target.closest('.theme-toggle-btn')) {
    $$('.dropdown-panel').forEach(p => p.classList.remove('show'));
  }
});

function logoutUser() {
  clearSession();
  localStorage.removeItem('cart'); // Clear cart on logout
  showToast('Logged out successfully');
  setTimeout(() => window.location.href = 'index.html', 600);
}

// ─── Premium Cart Page Renderer ─────────────────────────────
function renderPremiumCart() {
  const listEl = $('#cart-items');
  const summaryEl = $('#cart-summary');
  if (!listEl) return;

  const cart = getCart();
  if (cart.length === 0) {
    listEl.innerHTML = `
      <div class="cart-empty">
        <div class="empty-icon">🛍️</div>
        <h3>Your bag is empty</h3>
        <p>Looks like you haven't added anything yet.</p>
        <a href="experiment1on_capstone.html">Start Shopping</a>
      </div>`;
    if (summaryEl) summaryEl.style.display = 'none';
    return;
  }

  if (summaryEl) summaryEl.style.display = 'block';

  listEl.innerHTML = cart.map((item, i) => {
    const qty = item.quantity || 1;
    const total = item.price * qty;
    return `
      <div class="cart-item" style="animation-delay: ${i * .06}s">
        <div class="cart-item-img">
          ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<span style="font-size:28px">📦</span>'}
        </div>
        <div class="cart-item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-unit-price">₹${item.price.toLocaleString()} each</div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" onclick="changeCartQty(${i}, -1)">−</button>
          <span class="qty-display">${qty}</span>
          <button class="qty-btn" onclick="changeCartQty(${i}, 1)">+</button>
        </div>
        <div class="cart-item-total">₹${total.toLocaleString()}</div>
        <button class="remove-btn" onclick="removeCartItem(${i})" title="Remove">🗑️</button>
      </div>`;
  }).join('');

  // summary calculations
  const subtotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const itemCount = cart.reduce((s, i) => s + (i.quantity || 1), 0);
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="cart-summary">
        <div class="cart-summary-row"><span>Items (${itemCount})</span><span>₹${subtotal.toLocaleString()}</span></div>
        <div class="cart-summary-row"><span>Delivery</span><span style="color: var(--clr-emerald)">FREE</span></div>
        <div class="cart-summary-row total"><span>Total</span><span>₹${subtotal.toLocaleString()}</span></div>
      </div>
      <button class="checkout-btn" onclick="checkoutCart()">Proceed to Checkout →</button>
      <div class="cart-footer-links">
        <a href="experiment1on_capstone.html">← Continue Shopping</a>
        <button onclick="emptyCart()">Empty Bag</button>
      </div>`;
  }
}

function changeCartQty(index, delta) {
  const cart = getCart();
  if (!cart[index]) return;
  cart[index].quantity = (cart[index].quantity || 1) + delta;
  if (cart[index].quantity <= 0) cart.splice(index, 1);
  saveCart(cart);
  renderPremiumCart();
}
function removeCartItem(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderPremiumCart();
}
function emptyCart() {
  if (!confirm('Remove all items from your bag?')) return;
  saveCart([]);
  renderPremiumCart();
}
function checkoutCart() {
  const session = getSession();
  if (!session) {
    showToast('Please login to checkout', 'error');
    setTimeout(() => window.location.href = 'login.html', 1000);
    return;
  }
  showToast('Order placed successfully! 🎉');
  addNotification('Order Confirmed! 🎉', 'Your order is being prepared.', '📦', 'green');
  saveCart([]);
  setTimeout(() => renderPremiumCart(), 800);
}

// ─── Auth API calls ─────────────────────────────────────────
async function apiSignup(data) {
  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (err) {
    console.error(err);
    return { success: false, message: 'Could not connect to the backend server. Are you visiting via http://localhost:8000 ?' };
  }
}

async function apiLogin(data) {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (err) {
    console.error(err);
    return { success: false, message: 'Could not connect to the backend server. Are you visiting via http://localhost:8000 ?' };
  }
}

// localStorage fallback (works without backend)
function localSignup(data) {
  const users = JSON.parse(localStorage.getItem('shopease_users') || '[]');
  if (users.find(u => u.email === data.email)) {
    return { success: false, message: 'Email already registered' };
  }
  users.push({ name: data.name, email: data.email, password: data.password, phone: data.phone || '' });
  localStorage.setItem('shopease_users', JSON.stringify(users));
  return { success: true, message: 'Account created!' };
}
function localLogin(data) {
  const users = JSON.parse(localStorage.getItem('shopease_users') || '[]');
  const user = users.find(u => u.email === data.email && u.password === data.password);
  if (user) return { success: true, message: 'Login successful', user: { name: user.name, email: user.email } };
  return { success: false, message: 'Invalid email or password' };
}

// ─── Init on DOM Ready ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  if ($('#navbar-container')) renderNavbar('navbar-container');
  if ($('#cart-items')) renderPremiumCart();
  initSearch();
  updateCartBadge();
  await fetchProductsCache();
  await fetchCartOnLoad();
});
