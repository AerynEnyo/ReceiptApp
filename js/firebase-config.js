    const firebaseConfig = {
      apiKey: "AIzaSyD7RRmxNUJmwV-zGIWBsjnBoiqSYxklScM",
      authDomain: "receiptapp-14299.firebaseapp.com",
      projectId: "receiptapp-14299",
      storageBucket: "receiptapp-14299.firebasestorage.app",
      messagingSenderId: "132326209159",
      appId: "1:132326209159:web:e002837b0587acee27aa22"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    db.settings({ experimentalForceLongPolling: true });