// ---------------- DOM Refs ----------------
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');

const initialBalanceSetup = document.getElementById('initial-balance-setup');
const initialOnlineInput = document.getElementById('initial-online');
const initialCashInput = document.getElementById('initial-cash');
const saveInitialBalanceBtn = document.getElementById('save-initial-balance');

const currentOnlineBalanceElem = document.getElementById('current-online-balance');
const currentCashBalanceElem = document.getElementById('current-cash-balance');
const todayIncomeElem = document.getElementById('today-income');
const todayExpenseElem = document.getElementById('today-expense');
const totalCurrentBalanceElem = document.getElementById('total-current-balance');

const transactionTypeSelect = document.getElementById('transaction-type');
const amountInput = document.getElementById('amount');
const descriptionInput = document.getElementById('description');
const descriptionGroup = document.getElementById('description-group');
const customerNameInput = document.getElementById('customer-name');
const customerNameGroup = document.getElementById('customer-name-group');
const addTransactionBtn = document.getElementById('add-transaction-btn');

const dashboardSection = document.getElementById('dashboard');
const onlineTransactionsSection = document.getElementById('online-transactions');
const cashTransactionsSection = document.getElementById('cash-transactions');
const dueCustomersSection = document.getElementById('due-customers');

const onlineTransactionList = document.getElementById('online-transaction-list');
const cashTransactionList = document.getElementById('cash-transaction-list');
const dueCustomerList = document.getElementById('due-customer-list');

const navButtons = document.querySelectorAll('.nav-button');

const customerDetailsModal = document.getElementById('customer-details-modal');
const modalCloseButton = customerDetailsModal.querySelector('.close-button');
const modalCustomerName = document.getElementById('modal-customer-name');
const modalTotalDue = document.getElementById('modal-total-due');
const modalTransactionHistory = document.getElementById('modal-transaction-history');

// ---------------- State ----------------
let userDocRef = null;
let userId = null;

// ---------------- Auth ----------------
auth.onAuthStateChanged(async user => {
  if (user) {
    userId = user.uid;
    userDocRef = db.collection('users').doc(userId);

    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');

    await ensureUserDoc(); // user root doc আছে কিনা নিশ্চিত করি
    await checkInitialBalanceSetup();
    await loadDashboardData();
    await loadTransactions('online');
    await loadTransactions('cash');
    await loadDueCustomers();
  } else {
    userId = null;
    userDocRef = null;

    loginSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    loginEmailInput.value = "your@example.com";
    loginPasswordInput.value = "your_password";
    loginError.textContent = '';
  }
});

loginButton.addEventListener('click', async () => {
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value.trim();
  try {
    await auth.signInWithEmailAndPassword(email, password);
    loginError.textContent = '';
  } catch (error) {
    console.error('Login error:', error);
    loginError.textContent = 'লগইন ব্যর্থ হয়েছে: ' + error.message;
  }
});

logoutButton.addEventListener('click', async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error('Logout error:', error.message);
  }
});

// ---------------- Helpers ----------------

// user root doc না থাকলে বানিয়ে দাও (safe)
async function ensureUserDoc() {
  if (!userDocRef) return;
  const snap = await userDocRef.get();
  if (!snap.exists) {
    await userDocRef.set({
      initialOnlineBalance: 0,
      initialCashBalance: 0,
      currentOnlineBalance: 0,
      currentCashBalance: 0,
      todayIncome: 0,
      todayExpense: 0,
      initialSetupDone: false,
      lastUpdatedDate: new Date().toISOString().slice(0, 10)
    }, { merge: true });
  }
}

// ---------------- Initial Balance ----------------
async function checkInitialBalanceSetup() {
  if (!userDocRef) return;
  const doc = await userDocRef.get();
  if (doc.exists && doc.data().initialSetupDone) {
    initialBalanceSetup.classList.add('hidden');
  } else {
    initialBalanceSetup.classList.remove('hidden');
  }
}

saveInitialBalanceBtn.addEventListener('click', async () => {
  if (!userDocRef) return;
  const initialOnline = parseFloat(initialOnlineInput.value) || 0;
  const initialCash = parseFloat(initialCashInput.value) || 0;

  await userDocRef.set({
    initialOnlineBalance: initialOnline,
    initialCashBalance: initialCash,
    currentOnlineBalance: initialOnline,
    currentCashBalance: initialCash,
    initialSetupDone: true,
    todayIncome: 0,
    todayExpense: 0,
    lastUpdatedDate: new Date().toISOString().slice(0, 10)
  }, { merge: true });

  initialBalanceSetup.classList.add('hidden');
  loadDashboardData();
});

// ---------------- Dashboard ----------------
async function loadDashboardData() {
  if (!userDocRef) return;
  const doc = await userDocRef.get();
  if (!doc.exists) return;

  const data = doc.data();
  const today = new Date().toISOString().slice(0, 10);
  const lastUpdatedDate = data.lastUpdatedDate;

  let currentOnline = data.currentOnlineBalance || 0;
  let currentCash = data.currentCashBalance || 0;
  let todayIncome = 0;
  let todayExpense = 0;

  if (lastUpdatedDate !== today) {
    await userDocRef.set({
      todayIncome: 0,
      todayExpense: 0,
      lastUpdatedDate: today
    }, { merge: true });
  } else {
    todayIncome = data.todayIncome || 0;
    todayExpense = data.todayExpense || 0;
  }

  currentOnlineBalanceElem.textContent = `৳ ${currentOnline.toFixed(2)}`;
  currentCashBalanceElem.textContent = `৳ ${currentCash.toFixed(2)}`;
  todayIncomeElem.textContent = `৳ ${todayIncome.toFixed(2)}`;
  todayExpenseElem.textContent = `৳ ${todayExpense.toFixed(2)}`;
  totalCurrentBalanceElem.textContent = `৳ ${(currentOnline + currentCash).toFixed(2)}`;
}

// ---------------- Transaction Input ----------------
transactionTypeSelect.addEventListener('change', () => {
  const selectedType = transactionTypeSelect.value;
  customerNameGroup.classList.add('hidden');
  descriptionGroup.classList.remove('hidden');

  if (selectedType.startsWith('due-')) {
    customerNameGroup.classList.remove('hidden');
    if (selectedType !== 'due-add') {
      descriptionGroup.classList.add('hidden');
    }
  } else {
    descriptionInput.placeholder = (selectedType.includes('income'))
      ? 'যেমন: হেডফোন বিক্রি'
      : 'যেমন: দোকানের চা খরচ / রিচার্জ';
  }
});

addTransactionBtn.addEventListener('click', async () => {
  if (!userDocRef) return;

  const type = transactionTypeSelect.value;
  const amount = parseFloat(amountInput.value);
  const description = descriptionInput.value || '';
  const customerName = customerNameInput.value || '';
  const timestamp = firebase.firestore.FieldValue.serverTimestamp();
  const date = new Date().toISOString().slice(0, 10);

  if (isNaN(amount) || amount <= 0) {
    alert('পরিমাণ সঠিক ভাবে দিন।');
    return;
  }

  // initial setup না করলে block করো (না করলে userDoc update ব্যর্থ হতে পারে)
  const rootSnap = await userDocRef.get();
  if (!rootSnap.exists || !rootSnap.data().initialSetupDone) {
    alert('আগে প্রাথমিক ব্যালেন্স সেট করুন।');
    initialBalanceSetup.classList.remove('hidden');
    return;
  }

  const transactionData = {
    type,
    amount,
    description,
    timestamp,
    date
  };

  let userUpdates = {};
  let transactionCollection = null;

  switch (type) {
    case 'cash-income':
      userUpdates = {
        currentCashBalance: firebase.firestore.FieldValue.increment(amount),
        todayIncome: firebase.firestore.FieldValue.increment(amount)
      };
      transactionCollection = 'cashTransactions';
      break;

    case 'cash-expense':
      userUpdates = {
        currentCashBalance: firebase.firestore.FieldValue.increment(-amount),
        todayExpense: firebase.firestore.FieldValue.increment(amount)
      };
      transactionCollection = 'cashTransactions';
      break;

    case 'online-income':
      userUpdates = {
        currentOnlineBalance: firebase.firestore.FieldValue.increment(amount),
        todayIncome: firebase.firestore.FieldValue.increment(amount)
      };
      transactionCollection = 'onlineTransactions';
      break;

    case 'online-expense':
      userUpdates = {
        currentOnlineBalance: firebase.firestore.FieldValue.increment(-amount),
        todayExpense: firebase.firestore.FieldValue.increment(amount)
      };
      transactionCollection = 'onlineTransactions';
      break;

    case 'due-add':
      if (!customerName.trim()) {
        alert('কাস্টমারের নাম দিন।');
        return;
      }
      transactionData.customerName = customerName.trim();
      transactionData.isDue = true;
      transactionData.isCollected = false;
      transactionCollection = 'dueTransactions';
      // বিক্রির due ধরলে আজকের আয়ে যোগ হচ্ছে (তুমি যেমন রেখেছিলে)
      userUpdates = {
        todayIncome: firebase.firestore.FieldValue.increment(amount)
      };
      break;

    case 'due-collect-cash':
      if (!customerName.trim()) {
        alert('কাস্টমারের নাম দিন।');
        return;
      }
      transactionData.customerName = customerName.trim();
      transactionData.isDueCollection = true;
      userUpdates = {
        currentCashBalance: firebase.firestore.FieldValue.increment(amount),
        todayIncome: firebase.firestore.FieldValue.increment(amount)
      };
      transactionCollection = 'dueTransactions';
      break;

    case 'due-collect-online':
      if (!customerName.trim()) {
        alert('কাস্টমারের নাম দিন।');
        return;
      }
      transactionData.customerName = customerName.trim();
      transactionData.isDueCollection = true;
      userUpdates = {
        currentOnlineBalance: firebase.firestore.FieldValue.increment(amount),
        todayIncome: firebase.firestore.FieldValue.increment(amount)
      };
      transactionCollection = 'dueTransactions';
      break;

    default:
      alert('অজানা লেনদেন টাইপ।');
      return;
  }

  try {
    // ------ Correct batch usage ------
    const batch = db.batch();

    // 1) user root doc update
    batch.update(userDocRef, userUpdates);

    // 2) subcollection doc ref তৈরি করে set() দাও
    const txnRef = userDocRef.collection(transactionCollection).doc();
    batch.set(txnRef, transactionData);

    // 3) commit
    await batch.commit();

    alert('লেনদেন সফলভাবে যোগ হয়েছে!');
    amountInput.value = '';
    descriptionInput.value = '';
    customerNameInput.value = '';

    // Refresh UI
    await loadDashboardData();
    if (transactionCollection === 'onlineTransactions') {
      await loadTransactions('online');
    } else if (transactionCollection === 'cashTransactions') {
      await loadTransactions('cash');
    }
    await loadDueCustomers();

  } catch (error) {
    console.error('Error adding transaction:', error);
    alert('লেনদেন যোগ করতে সমস্যা হয়েছে: ' + error.message);
  }
});

// ---------------- Transactions List ----------------
function formatTransaction(doc) {
  const data = doc.data();
  const dateStr = data.timestamp
    ? new Date(data.timestamp.toDate()).toLocaleString()
    : new Date(data.date).toLocaleString();

  let className = '';
  let amountText = '';

  if ((data.type && data.type.includes('income')) || data.type === 'due-add' || data.isDueCollection) {
    className = 'income';
    amountText = `+ ৳ ${Number(data.amount).toFixed(2)}`;
  } else if (data.type && data.type.includes('expense')) {
    className = 'expense';
    amountText = `- ৳ ${Number(data.amount).toFixed(2)}`;
  } else if (data.type === 'due-add') {
    className = 'due';
    amountText = `+ ৳ ${Number(data.amount).toFixed(2)}`;
  }

  let description = data.description || '';
  if (data.customerName) {
    description += (description ? ' ' : '') + `(${data.customerName})`;
  }
  if (data.type === 'due-add' && !data.isCollected) {
    description += ' (বাকি)';
  } else if (data.isDueCollection) {
    description = `ডিউ সংগ্রহ (${data.customerName || ''})`;
  }

  return `
    <li class="${className}">
      <div>
        <span>${description || data.type}</span><br>
        <small>${dateStr}</small>
      </div>
      <span class="amount ${className}">${amountText}</span>
    </li>
  `;
}

async function loadTransactions(type) {
  if (!userDocRef) return;

  let collectionName = '';
  let listElement = null;

  if (type === 'online') {
    collectionName = 'onlineTransactions';
    listElement = onlineTransactionList;
  } else if (type === 'cash') {
    collectionName = 'cashTransactions';
    listElement = cashTransactionList;
  } else {
    return;
  }

  listElement.innerHTML = '<p style="text-align: center; color: #777;">লোড হচ্ছে...</p>';

  try {
    const snapshot = await userDocRef.collection(collectionName)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    listElement.innerHTML = '';
    if (snapshot.empty) {
      listElement.innerHTML = '<p style="text-align: center; color: #777;">কোনো লেনদেন পাওয়া যায়নি।</p>';
      return;
    }

    snapshot.forEach(doc => {
      listElement.innerHTML += formatTransaction(doc);
    });
  } catch (error) {
    console.error(`Error loading ${type} transactions:`, error);
    listElement.innerHTML = `<p style="text-align: center; color: #e74c3c;">লেনদেন লোড করতে সমস্যা হয়েছে: ${error.message}</p>`;
  }
}

// ---------------- Due Customers ----------------
async function loadDueCustomers() {
  if (!userDocRef) return;
  dueCustomerList.innerHTML = '<p style="text-align: center; color: #777;">লোড হচ্ছে...</p>';

  try {
    const snapshot = await userDocRef.collection('dueTransactions')
      .where('isDue', '==', true)
      .where('isCollected', '==', false)
      .orderBy('customerName')
      .get();

    const customers = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const name = data.customerName;
      if (!name) return;
      if (!customers[name]) {
        customers[name] = { totalDue: 0, transactions: [] };
      }
      customers[name].totalDue += Number(data.amount) || 0;
      customers[name].transactions.push(data);
    });

    dueCustomerList.innerHTML = '';
    if (Object.keys(customers).length === 0) {
      dueCustomerList.innerHTML = '<p style="text-align: center; color: #777;">কোনো বাকি নেই।</p>';
      return;
    }

    for (const name in customers) {
      const c = customers[name];
      const li = document.createElement('li');
      li.className = 'customer-item';
      li.innerHTML = `
        <span class="customer-name">${name}</span>
        <span class="customer-due-amount">৳ ${c.totalDue.toFixed(2)}</span>
      `;
      li.dataset.customerName = name;
      li.addEventListener('click', () => showCustomerDetails(name, c));
      dueCustomerList.appendChild(li);
    }
  } catch (error) {
    console.error('Error loading due customers:', error);
    dueCustomerList.innerHTML = `<p style="text-align: center; color: #e74c3c;">ডিউ কাস্টমার লোড করতে সমস্যা হয়েছে: ${error.message}</p>`;
  }
}

async function showCustomerDetails(name, data) {
  modalCustomerName.textContent = name;
  modalTotalDue.textContent = `৳ ${data.totalDue.toFixed(2)}`;
  modalTransactionHistory.innerHTML = '';

  const customerTransactionsSnapshot = await userDocRef.collection('dueTransactions')
    .where('customerName', '==', name)
    .orderBy('timestamp', 'desc')
    .get();

  customerTransactionsSnapshot.forEach(doc => {
    const t = doc.data();
    const dateStr = t.timestamp
      ? new Date(t.timestamp.toDate()).toLocaleString()
      : new Date(t.date).toLocaleString();

    let status = '';
    let amountDisplay = '';

    if (t.isDue) {
      status = '(বাকি)';
      amountDisplay = `৳ ${Number(t.amount).toFixed(2)}`;
    } else if (t.isDueCollection) {
      status = '(সংগৃহীত)';
      amountDisplay = `+ ৳ ${Number(t.amount).toFixed(2)}`;
    }

    const li = document.createElement('li');
    li.innerHTML = `
      <span>${t.description || t.type} ${status}</span>
      <span>${amountDisplay} <small>(${dateStr})</small></span>
    `;
    modalTransactionHistory.appendChild(li);
  });

  customerDetailsModal.classList.remove('hidden');
}

modalCloseButton.addEventListener('click', () => {
  customerDetailsModal.classList.add('hidden');
});

window.addEventListener('click', (e) => {
  if (e.target === customerDetailsModal) {
    customerDetailsModal.classList.add('hidden');
  }
});

// ---------------- Navigation ----------------
navButtons.forEach(button => {
  button.addEventListener('click', async () => {
    navButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    dashboardSection.classList.add('hidden');
    onlineTransactionsSection.classList.add('hidden');
    cashTransactionsSection.classList.add('hidden');
    dueCustomersSection.classList.add('hidden');

    const target = button.dataset.target;
    document.getElementById(target).classList.remove('hidden');

    if (target === 'online-transactions') await loadTransactions('online');
    if (target === 'cash-transactions') await loadTransactions('cash');
    if (target === 'due-customers') await loadDueCustomers();
  });
});

// Ensure dashboard visible by default (also done after auth)
document.getElementById('dashboard').classList.remove('hidden');
