// script.js

// DOM Elements
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


let userDocRef = null; // Reference to the user's Firestore document
let userId = null; // Store current user ID

// --- Authentication Logic ---
auth.onAuthStateChanged(user => {
    if (user) {
        userId = user.uid;
        userDocRef = db.collection('users').doc(userId);
        loginSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        checkInitialBalanceSetup();
        loadDashboardData();
        loadTransactions('online');
        loadTransactions('cash');
        loadDueCustomers();
    } else {
        userId = null;
        userDocRef = null;
        loginSection.classList.remove('hidden');
        appSection.classList.add('hidden');
        // Reset inputs on logout
        loginEmailInput.value = "your@example.com"; // Keep for easy testing
        loginPasswordInput.value = "your_password"; // Keep for easy testing
        loginError.textContent = '';
    }
});

loginButton.addEventListener('click', async () => {
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
        loginError.textContent = ''; // Clear any previous error
    } catch (error) {
        console.error('Login error:', error.message);
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

// --- Initial Balance Setup Logic ---
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
        // Also initialize today's income/expense to 0 if not set
        todayIncome: 0,
        todayExpense: 0
    }, { merge: true }); // Use merge to avoid overwriting other data

    initialBalanceSetup.classList.add('hidden');
    loadDashboardData(); // Reload data after setup
});


// --- Dashboard Data Loading ---
async function loadDashboardData() {
    if (!userDocRef) return;
    const doc = await userDocRef.get();
    if (doc.exists) {
        const data = doc.data();
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const lastUpdatedDate = data.lastUpdatedDate; // Assuming you store this

        let currentOnline = data.currentOnlineBalance || 0;
        let currentCash = data.currentCashBalance || 0;
        let todayIncome = 0;
        let todayExpense = 0;

        // Reset today's summary if it's a new day
        if (lastUpdatedDate !== today) {
            await userDocRef.update({
                todayIncome: 0,
                todayExpense: 0,
                lastUpdatedDate: today // Update the date
            });
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
}

// --- Transaction Input Logic ---
transactionTypeSelect.addEventListener('change', () => {
    const selectedType = transactionTypeSelect.value;
    customerNameGroup.classList.add('hidden');
    descriptionGroup.classList.remove('hidden'); // Default to showing description

    if (selectedType.startsWith('due-')) {
        customerNameGroup.classList.remove('hidden');
        if (selectedType !== 'due-add') { // For collecting due, description might be less important
            descriptionGroup.classList.add('hidden');
        }
    } else {
        descriptionInput.placeholder = (selectedType.includes('income')) ? 'যেমন: হেডফোন বিক্রি' : 'যেমন: দোকানের চা খরচ / রিচার্জ';
    }
});

addTransactionBtn.addEventListener('click', async () => {
    if (!userDocRef) return;

    const type = transactionTypeSelect.value;
    const amount = parseFloat(amountInput.value);
    const description = descriptionInput.value;
    const customerName = customerNameInput.value;
    const timestamp = firebase.firestore.FieldValue.serverTimestamp();
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (isNaN(amount) || amount <= 0) {
        alert('পরিমাণ সঠিক ভাবে দিন।');
        return;
    }
    
    // Default data structure
    const transactionData = {
        type: type,
        amount: amount,
        description: description,
        timestamp: timestamp,
        date: date
    };

    let userUpdates = {}; // Updates to the user's main balance/summary
    let transactionCollection = null; // Which collection to save transaction to

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
            if (!customerName) {
                alert('কাস্টমারের নাম দিন।');
                return;
            }
            transactionData.customerName = customerName;
            transactionData.isDue = true;
            transactionData.isCollected = false;
            transactionCollection = 'dueTransactions';

            // Also update overall Today Income
            userUpdates = {
                todayIncome: firebase.firestore.FieldValue.increment(amount)
            };
            break;
        case 'due-collect-cash':
            if (!customerName) {
                alert('কাস্টমারের নাম দিন।');
                return;
            }
            // Find the specific due transaction to mark as collected
            // For simplicity here, we'll just add a new "collection" transaction
            // A more robust system would update the original due entry
            transactionData.customerName = customerName;
            transactionData.isDueCollection = true;
            userUpdates = {
                currentCashBalance: firebase.firestore.FieldValue.increment(amount),
                todayIncome: firebase.firestore.FieldValue.increment(amount)
            };
            transactionCollection = 'dueTransactions'; // Store collection as part of due transactions
            break;
        case 'due-collect-online':
            if (!customerName) {
                alert('কাস্টমারের নাম দিন।');
                return;
            }
            transactionData.customerName = customerName;
            transactionData.isDueCollection = true;
            userUpdates = {
                currentOnlineBalance: firebase.firestore.FieldValue.increment(amount),
                todayIncome: firebase.firestore.FieldValue.increment(amount)
            };
            transactionCollection = 'dueTransactions'; // Store collection as part of due transactions
            break;
    }

    try {
        // Perform batched writes for atomicity (update user data and add transaction)
        const batch = db.batch();
        batch.update(userDocRef, userUpdates);
        batch.collection('users').doc(userId).collection(transactionCollection).add(transactionData);
        await batch.commit();

        alert('লেনদেন সফলভাবে যোগ হয়েছে!');
        amountInput.value = '';
        descriptionInput.value = '';
        customerNameInput.value = '';

        loadDashboardData();
        loadTransactions(transactionCollection === 'onlineTransactions' ? 'online' : 'cash');
        loadDueCustomers(); // Reload due list to reflect changes
    } catch (error) {
        console.error('Error adding transaction:', error);
        alert('লেনদেন যোগ করতে সমস্যা হয়েছে: ' + error.message);
    }
});

// script.js (Continued from previous response)

// --- Load Transaction Lists ---
function formatTransaction(doc) {
    const data = doc.data();
    const date = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString() : new Date(data.date).toLocaleString(); // Handle both timestamp and date string
    let className = '';
    let amountText = '';
    
    // Determine class and amount text based on type
    if (data.type && data.type.includes('income') || data.type === 'due-add' || data.isDueCollection) {
        className = 'income';
        amountText = `+ ৳ ${data.amount.toFixed(2)}`;
    } else if (data.type && data.type.includes('expense')) {
        className = 'expense';
        amountText = `- ৳ ${data.amount.toFixed(2)}`;
    } else if (data.type === 'due-add') {
        className = 'due';
        amountText = `+ ৳ ${data.amount.toFixed(2)}`;
    }

    let description = data.description || '';
    if (data.customerName) {
        description += ` (${data.customerName})`;
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
                <small>${date}</small>
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
        return; // Invalid type
    }

    listElement.innerHTML = '<p style="text-align: center; color: #777;">লোড হচ্ছে...</p>';
    
    try {
        const snapshot = await userDocRef.collection(collectionName)
            .orderBy('timestamp', 'desc')
            .limit(20) // Load last 20 transactions for simplicity
            .get();

        listElement.innerHTML = ''; // Clear loading text
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


// --- Due Customer Logic ---
async function loadDueCustomers() {
    if (!userDocRef) return;
    dueCustomerList.innerHTML = '<p style="text-align: center; color: #777;">লোড হচ্ছে...</p>';

    try {
        const snapshot = await userDocRef.collection('dueTransactions')
            .where('isDue', '==', true)
            .where('isCollected', '==', false) // Only show uncollected dues
            .orderBy('customerName')
            .get();

        const customers = {}; // Group by customer
        snapshot.forEach(doc => {
            const data = doc.data();
            const customerName = data.customerName;
            if (customerName) {
                if (!customers[customerName]) {
                    customers[customerName] = { totalDue: 0, transactions: [] };
                }
                customers[customerName].totalDue += data.amount;
                customers[customerName].transactions.push(data);
            }
        });

        dueCustomerList.innerHTML = '';
        if (Object.keys(customers).length === 0) {
            dueCustomerList.innerHTML = '<p style="text-align: center; color: #777;">কোনো বাকি নেই।</p>';
            return;
        }

        for (const name in customers) {
            const customerData = customers[name];
            const li = document.createElement('li');
            li.className = 'customer-item';
            li.innerHTML = `
                <span class="customer-name">${name}</span>
                <span class="customer-due-amount">৳ ${customerData.totalDue.toFixed(2)}</span>
            `;
            li.dataset.customerName = name;
            li.addEventListener('click', () => showCustomerDetails(name, customerData));
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

    // Fetch all transactions for this customer (including collections for history)
    const customerTransactionsSnapshot = await userDocRef.collection('dueTransactions')
        .where('customerName', '==', name)
        .orderBy('timestamp', 'desc')
        .get();

    customerTransactionsSnapshot.forEach(doc => {
        const transaction = doc.data();
        const li = document.createElement('li');
        const date = transaction.timestamp ? new Date(transaction.timestamp.toDate()).toLocaleString() : new Date(transaction.date).toLocaleString();
        let status = '';
        let amountDisplay = '';

        if (transaction.isDue) {
            status = '(বাকি)';
            amountDisplay = `৳ ${transaction.amount.toFixed(2)}`;
            li.style.color = '#f39c12'; // Yellow for due
        } else if (transaction.isDueCollection) {
            status = '(সংগৃহীত)';
            amountDisplay = `+ ৳ ${transaction.amount.toFixed(2)}`;
            li.style.color = '#27ae60'; // Green for collected
        }
        
        li.innerHTML = `
            <span>${transaction.description || transaction.type} ${status}</span>
            <span>${amountDisplay} <small>(${date})</small></span>
        `;
        modalTransactionHistory.appendChild(li);
    });

    customerDetailsModal.classList.remove('hidden');
}

modalCloseButton.addEventListener('click', () => {
    customerDetailsModal.classList.add('hidden');
});

// Close modal if clicked outside
window.addEventListener('click', (event) => {
    if (event.target === customerDetailsModal) {
        customerDetailsModal.classList.add('hidden');
    }
});


// --- Navigation Logic ---
navButtons.forEach(button => {
    button.addEventListener('click', () => {
        navButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Hide all sections first
        dashboardSection.classList.add('hidden');
        onlineTransactionsSection.classList.add('hidden');
        cashTransactionsSection.classList.add('hidden');
        dueCustomersSection.classList.add('hidden');

        // Show the target section
        const target = button.dataset.target;
        document.getElementById(target).classList.remove('hidden');

        // Reload data for the active section
        if (target === 'online-transactions') loadTransactions('online');
        if (target === 'cash-transactions') loadTransactions('cash');
        if (target === 'due-customers') loadDueCustomers();
        // Dashboard data is reloaded on transaction add or initial load
    });
});

// Initial load for dashboard
// This is called from auth.onAuthStateChanged
// loadDashboardData();
// By default, dashboard is shown on app load
document.getElementById('dashboard').classList.remove('hidden');
