// script.js
import {
    getFirestore, doc, getDoc, setDoc, updateDoc,
    collection, addDoc, serverTimestamp, writeBatch, increment
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Firestore & Auth Init
const db = getFirestore();
const auth = getAuth();

let userDocRef = null;
let userId = null;

// --- Authentication Logic ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        userDocRef = doc(db, "users", userId);

        loginSection.classList.add("hidden");
        appSection.classList.remove("hidden");

        await checkInitialBalanceSetup();
        await loadDashboardData();
        await loadTransactions("online");
        await loadTransactions("cash");
        await loadDueCustomers();
    } else {
        userId = null;
        userDocRef = null;
        loginSection.classList.remove("hidden");
        appSection.classList.add("hidden");
    }
});

loginButton.addEventListener("click", async () => {
    try {
        await signInWithEmailAndPassword(auth, loginEmailInput.value, loginPasswordInput.value);
        loginError.textContent = "";
    } catch (error) {
        console.error("Login error:", error.message);
        loginError.textContent = "লগইন ব্যর্থ: " + error.message;
    }
});

logoutButton.addEventListener("click", async () => {
    await signOut(auth);
});

// --- Initial Balance Setup ---
async function checkInitialBalanceSetup() {
    if (!userDocRef) return;
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists() && docSnap.data().initialSetupDone) {
        initialBalanceSetup.classList.add("hidden");
    } else {
        initialBalanceSetup.classList.remove("hidden");
    }
}

saveInitialBalanceBtn.addEventListener("click", async () => {
    if (!userDocRef) return;

    const initialOnline = parseFloat(initialOnlineInput.value) || 0;
    const initialCash = parseFloat(initialCashInput.value) || 0;

    await setDoc(userDocRef, {
        initialOnlineBalance: initialOnline,
        initialCashBalance: initialCash,
        currentOnlineBalance: initialOnline,
        currentCashBalance: initialCash,
        initialSetupDone: true,
        todayIncome: 0,
        todayExpense: 0,
    }, { merge: true });

    initialBalanceSetup.classList.add("hidden");
    loadDashboardData();
});

// --- Add Transaction ---
addTransactionBtn.addEventListener("click", async () => {
    if (!userDocRef) return;

    const type = transactionTypeSelect.value;
    const amount = parseFloat(amountInput.value);
    const description = descriptionInput.value;
    const customerName = customerNameInput.value;
    const date = new Date().toISOString().slice(0, 10);

    if (isNaN(amount) || amount <= 0) {
        alert("পরিমাণ সঠিক দিন।");
        return;
    }

    const transactionData = {
        type,
        amount,
        description,
        date,
        timestamp: serverTimestamp()
    };

    let userUpdates = {};
    let transactionCollection = "";

    switch (type) {
        case "cash-income":
            userUpdates = {
                currentCashBalance: increment(amount),
                todayIncome: increment(amount),
            };
            transactionCollection = "cashTransactions";
            break;
        case "cash-expense":
            userUpdates = {
                currentCashBalance: increment(-amount),
                todayExpense: increment(amount),
            };
            transactionCollection = "cashTransactions";
            break;
        case "online-income":
            userUpdates = {
                currentOnlineBalance: increment(amount),
                todayIncome: increment(amount),
            };
            transactionCollection = "onlineTransactions";
            break;
        case "online-expense":
            userUpdates = {
                currentOnlineBalance: increment(-amount),
                todayExpense: increment(amount),
            };
            transactionCollection = "onlineTransactions";
            break;
        case "due-add":
            if (!customerName) {
                alert("কাস্টমারের নাম দিন।");
                return;
            }
            transactionData.customerName = customerName;
            transactionData.isDue = true;
            transactionCollection = "dueTransactions";
            break;
        case "due-collect-cash":
            transactionData.customerName = customerName;
            transactionData.isDueCollection = true;
            userUpdates = {
                currentCashBalance: increment(amount),
                todayIncome: increment(amount),
            };
            transactionCollection = "dueTransactions";
            break;
        case "due-collect-online":
            transactionData.customerName = customerName;
            transactionData.isDueCollection = true;
            userUpdates = {
                currentOnlineBalance: increment(amount),
                todayIncome: increment(amount),
            };
            transactionCollection = "dueTransactions";
            break;
    }

    try {
        const batch = writeBatch(db);

        batch.update(userDocRef, userUpdates);

        const txnRef = doc(collection(userDocRef, transactionCollection));
        batch.set(txnRef, transactionData);

        await batch.commit();

        alert("লেনদেন সফল!");
        amountInput.value = "";
        descriptionInput.value = "";
        customerNameInput.value = "";

        loadDashboardData();
        loadTransactions(transactionCollection === "onlineTransactions" ? "online" : "cash");
        loadDueCustomers();
    } catch (error) {
        console.error("Error adding transaction:", error);
        alert("লেনদেন যোগ করতে সমস্যা: " + error.message);
    }
});
