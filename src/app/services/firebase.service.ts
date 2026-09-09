import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, off, remove, update, get, runTransaction } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyCxsMUUHvw_LQrl24VgDtJiperHF2rRL_Y',
  authDomain: 'rpgwow-118f7.firebaseapp.com',
  databaseURL: 'https://rpgwow-118f7-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'rpgwow-118f7',
  storageBucket: 'rpgwow-118f7.firebasestorage.app',
  messagingSenderId: '408168433969',
  appId: '1:408168433969:web:d1f8521365c247ac934810',
  measurementId: 'G-STV8D02FJV',
};

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private app = initializeApp(firebaseConfig);
  private db = getDatabase(this.app);

  pushData(path: string, data: any) {
    return push(ref(this.db, path), data);
  }

  setData(path: string, data: any) {
    return update(ref(this.db, path), data);
  }

  removeData(path: string) {
    return remove(ref(this.db, path));
  }

  onValue(path: string, callback: (data: any) => void) {
    const r = ref(this.db, path);
    const unsubscribe = onValue(r, (snapshot) => {
      callback(snapshot.val());
    });
    return () => off(r, 'value', unsubscribe);
  }

  async onceValue(path: string): Promise<any> {
    const snapshot = await get(ref(this.db, path));
    return snapshot.val();
  }

  async claimEvent(key: string, claimer: string): Promise<boolean> {
    const r = ref(this.db, 'playerEvents/' + key);
    try {
      const res = await runTransaction(r, (current: any) => {
        if (current === null) return undefined;
        if (current.processedBy) {
          const stale = Date.now() - (current.claimedAt || 0) >= 30000;
          if (!stale) return current;
        }
        return { ...current, processedBy: claimer, claimedAt: Date.now() };
      });
      const val = res.snapshot ? res.snapshot.val() : null;
      return !!(val && val.processedBy === claimer);
    } catch (e) {
      console.error('claimEvent error:', e);
      return false;
    }
  }

  getDb() {
    return this.db;
  }
}
