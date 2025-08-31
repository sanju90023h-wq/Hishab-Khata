// Firebase Auth and Firestore references
const auth = firebase.auth();
const db = firebase.firestore();

// Elements
const loginPage = document.getElementById("login-page");
const dashboard = document.getElementById("dashboard");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const amountInput = document.getElementById("amount");
const descriptionInput = document.getElementById("description");
const customerNameInput = document.getElementById("customerName");
const typeSelect = document.getElementById("type");
const transactionTypeSelect = document.getElementById("transactionType");
const addTransactionBtn = document.getElementById("add-transaction-btn");

const cashBalanceEl = document.getElementById("cash-balance");
const onlineBalanceEl = document.getElementById("online-balance");
const todayIncomeEl = document.getElementById("today-income");
const todayExpenseEl = document.getElementById("today-expense");

const cashTransactionsEl = document.getElementById("cash-transactions");
const onlineTransactionsEl = document.getElementById("online-transactions");
const dueCustomersEl = document.getElementById("due-customers");

// ----------------------------- AUTH ----------------------------- //

loginBtn.addEventListener("click", () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
});

logoutBtn.addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(async (user) => {
  if (user) {
    loginPage.classList.add("hidden");
    dashboard.classList.remove("hidden");

    const userDocRef = db.collection("users").doc(user.uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      // নতুন ইউজারের জন্য ডকুমেন্ট তৈরি
      await userDocRef.set({
        currentCashBalance: 0,
        currentOnlineBalance: 0,
        todayIncome: 0,
        todayExpense: 0,
        initialSetupDone: true,
      });
    }

    loadDashboardData();
    loadTransactions("cash");
    loadTransactions("online");
    loadDueCustomers();
  } else {
    loginPage.classList.remove("hidden");
    dashboard.classList.add("hidden");
  }
});

// ----------------------------- TRANSACTION ADD ----------------------------- //

addTransactionBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Please log in first");

  const amount = parseFloat(amountInput.value);
  const description = descriptionInput.value.trim();
  const customerName = customerNameInput.value.trim();
  const type = typeSelect.value;
  const transactionType = transactionTypeSelect.value;

  if (isNaN(amount) || amount <= 0) {
    return alert("Enter a valid amount");
  }

  const userDocRef = db.collection("users").doc(user.uid);
  const userDoc = await userDocRef.get();
  const userData = userDoc.data();

  const transactionData = {
    amount,
    description,
    customerName: customerName || null,
    type,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  let userUpdates = {};

  if (transactionType === "cash") {
    if (type === "income") {
      userUpdates = {
        currentCashBalance: firebase.firestore.FieldValue.increment(amount),
        todayIncome: firebase.firestore.FieldValue.increment(amount),
      };
    } else if (type === "expense") {
      userUpdates = {
        currentCashBalance: firebase.firestore.FieldValue.increment(-amount),
        todayExpense: firebase.firestore.FieldValue.increment(amount),
      };
    }
    await addTransaction(user.uid, "cashTransactions", transactionData, userUpdates);
  }

  else if (transactionType === "online") {
    if (type === "income") {
      userUpdates = {
        currentOnlineBalance: firebase.firestore.FieldValue.increment(amount),
        todayIncome: firebase.firestore.FieldValue.increment(amount),
      };
    } else if (type === "expense") {
      userUpdates = {
        currentOnlineBalance: firebase.firestore.FieldValue.increment(-amount),
        todayExpense: firebase.firestore.FieldValue.increment(amount),
      };
    }
    await addTransaction(user.uid, "onlineTransactions", transactionData, userUpdates);
  }

  else if (transactionType === "due") {
    transactionData.isDue = true;
    transactionData.isCollected = false;

    userUpdates = {
      todayIncome: firebase.firestore.FieldValue.increment(amount),
    };

    await addTransaction(user.uid, "dueTransactions", transactionData, userUpdates);
  }
});

// ----------------------------- ADD TRANSACTION FUNCTION ----------------------------- //

async function addTransaction(userId, transactionCollection, transactionData, userUpdates) {
  try {
    const userDocRef = db.collection("users").doc(userId);
    const batch = db.batch();

    if (userUpdates && Object.keys(userUpdates).length > 0) {
      batch.update(userDocRef, userUpdates);
    }

    const txnRef = userDocRef.collection(transactionCollection).doc();
    batch.set(txnRef, transactionData);

    await batch.commit();

    alert("লেনদেন সফলভাবে যোগ হয়েছে!");
    amountInput.value = "";
    descriptionInput.value = "";
    customerNameInput.value = "";

    loadDashboardData();
    loadTransactions(transactionCollection === "onlineTransactions" ? "online" : "cash");
    loadDueCustomers();
  } catch (error) {
    console.error("Error adding transaction:", error);
    alert("লেনদেন যোগ করতে সমস্যা হয়েছে: " + error.message);
  }
}

// ----------------------------- LOAD DASHBOARD DATA ----------------------------- //

async function loadDashboardData() {
  const user = auth.currentUser;
  if (!user) return;

  const userDocRef = db.collection("users").doc(user.uid);
  const userDoc = await userDocRef.get();
  const data = userDoc.data();

  cashBalanceEl.textContent = data.currentCashBalance;
  onlineBalanceEl.textContent = data.currentOnlineBalance;
  todayIncomeEl.textContent = data.todayIncome;
  todayExpenseEl.textContent = data.todayExpense;
}

// ----------------------------- LOAD TRANSACTIONS ----------------------------- //

async function loadTransactions(type) {
  const user = auth.currentUser;
  if (!user) return;

  const collectionName = type === "cash" ? "cashTransactions" : "onlineTransactions";
  const container = type === "cash" ? cashTransactionsEl : onlineTransactionsEl;

  const snapshot = await db
    .collection("users")
    .doc(user.uid)
    .collection(collectionName)
    .orderBy("createdAt", "desc")
    .limit(10)
    .get();

  container.innerHTML = "";
  snapshot.forEach((doc) => {
    const t = doc.data();
    const li = document.createElement("li");
    li.textContent = `${t.type.toUpperCase()} - ${t.amount} (${t.description || "No description"})`;
    container.appendChild(li);
  });
}

// ----------------------------- LOAD DUE CUSTOMERS ----------------------------- //

async function loadDueCustomers() {
  const user = auth.currentUser;
  if (!user) return;

  const snapshot = await db
    .collection("users")
    .doc(user.uid)
    .collection("dueTransactions")
    .where("isDue", "==", true)
    .where("isCollected", "==", false)
    .get();

  dueCustomersEl.innerHTML = "";
  snapshot.forEach((doc) => {
    const d = doc.data();
    const li = document.createElement("li");
    li.textContent = `${d.customerName} - ${d.amount} টাকা বাকি আছে`;
    dueCustomersEl.appendChild(li);
  });
}
