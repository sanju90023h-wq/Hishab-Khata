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
        loginEmailInput.value = "your@example.com";
        loginPasswordInput.value = "your_password";
        loginError.textContent = '';
    }
});

loginButton.addEventListener('click', async () => {
    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;
    try {
        await auth.signInWithEmailAndPassword(email, password);
        loginError.textContent = '';
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
        todayIncome: 0,
        todayExpense: 0
    }, { merge: true });

    initialBalanceSetup.classList.add('hidden');
    loadDashboardData();
});

// --- Dashboard Data Loading ---
async function loadDashboardData() {
    if (!userDocRef) return;
    const doc = await userDocRef.get();
    if (doc.exists) {
        const data = doc.data();
        const today = new Date().toISOString().slice(0, 10);
        const lastUpdatedDate = data.lastUpdatedDate;

        let currentOnline = data.currentOnlineBalance || 0;
        let currentCash = data.currentCashBalance || 0;
        let todayIncome = 0;
        let todayExpense = 0;

        if (lastUpdatedDate !== today) {
            await userDocRef.update({
                todayIncome: 0,
                todayExpense: 0,
                lastUpdatedDate: today
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
    descriptionGroup.classList.remove('hidden');

    if (selectedType.startsWith('due-')) {
        customerNameGroup.classList.remove('hidden');
        if (selectedType !== 'due-add') {
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
    const date = new Date().toISOString().slice(0, 10);

    if (isNaN(amount) || amount <= 0) {
        alert('পরিমাণ সঠিক ভাবে দিন।');
        return;
    }
    
    const transactionData = {
        type, amount, description, timestamp, date
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
            if (!customerName) {
                alert('কাস্টমারের নাম দিন।');
                return;
            }
            transactionData.customerName = customerName;
            transactionData.isDue = true;
            transactionData.isCollected = false;
            transactionCollection = 'dueTransactions';
            userUpdates = {
                todayIncome: firebase.firestore.FieldValue.increment(amount)
            };
            break;
        case 'due-collect-cash':
            if (!customerName) {
                alert('কাস্টমারের নাম দিন।');
                return;
            }
            transactionData.customerName = customerName;
            transactionData.isDueCollection = true;
            userUpdates = {
                currentCashBalance: firebase.firestore.FieldValue.increment(amount),
                todayIncome: firebase.firestore.FieldValue.increment(amount)
            };
            transactionCollection = 'dueTransactions';
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
            transactionCollection = 'dueTransactions';
            break;
    }

    try {
        const batch = db.batch();
        batch.update(userDocRef, userUpdates);
        const txnRef = userDocRef.collection(transactionCollection).doc();
        batch.set(txnRef, transactionData);
        await batch.commit();

        alert('লেনদেন সফলভাবে যোগ হয়েছে!');
        amountInput.value = '';
        descriptionInput.value = '';
        customerNameInput.value = '';

        loadDashboardData();
        loadTransactions(transactionCollection === 'onlineTransactions' ? 'online' : 'cash');
        loadDueCustomers();
    } catch (error) {
        console.error('Error adding transaction:', error);
        alert('লেনদেন যোগ করতে সমস্যা হয়েছে: ' + error.message);
    }
});
