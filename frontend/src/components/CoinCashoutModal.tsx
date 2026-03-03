/**
 * CoinCashoutModal — Two-step modal for cashing out Vibe Coins.
 * Step 1: Add / confirm bank account (Paystack account resolution).
 * Step 2: Enter coin amount → see naira equivalent → confirm transfer.
 * T&C: coins earned only at participating venues, cashback subject to available funds.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

interface Bank { name: string; code: string; }
interface BankAccount { saved: boolean; account_name?: string; account_number_masked?: string; bank_code?: string; }

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  authToken: string;
  balance: number;
  cashoutRateNaira: number;
  minCoins: number;
}

type Step = 'loading' | 'bank_setup' | 'cashout' | 'success' | 'error';

export default function CoinCashoutModal({
  visible, onClose, onSuccess, authToken, balance, cashoutRateNaira, minCoins,
}: Props) {
  const [step, setStep] = useState<Step>('loading');
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [accountNumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [bankSearch, setBankSearch] = useState('');
  const [resolvedName, setResolvedName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coins, setCoins] = useState(String(minCoins));
  const [cashing, setCashing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [nairaResult, setNairaResult] = useState(0);

  const headers = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    setStep('loading');
    try {
      const [acctRes, banksRes] = await Promise.all([
        fetch(`${API_URL}/api/coins/bank-account`, { headers }),
        fetch(`${API_URL}/api/coins/banks`, { headers }),
      ]);
      const acct: BankAccount = await acctRes.json();
      const banksData = await banksRes.json();
      setBankAccount(acct);
      setBanks(banksData.banks ?? []);
      setStep(acct.saved ? 'cashout' : 'bank_setup');
    } catch {
      setStep('error');
      setErrorMsg('Could not load account info. Try again.');
    }
  }, [authToken]);

  useEffect(() => { if (visible) load(); }, [visible]);

  // Auto-resolve account name when number is 10 digits and bank selected
  useEffect(() => {
    if (accountNumber.length === 10 && selectedBank) {
      setResolving(true);
      setResolvedName('');
      fetch(`${API_URL}/api/coins/bank-account`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ account_number: accountNumber, bank_code: selectedBank.code }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) setResolvedName(d.account_name);
          else setResolvedName('');
        })
        .catch(() => setResolvedName(''))
        .finally(() => setResolving(false));
    } else {
      setResolvedName('');
    }
  }, [accountNumber, selectedBank]);

  const saveAccount = async () => {
    if (!resolvedName || !selectedBank) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/coins/bank-account`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ account_number: accountNumber, bank_code: selectedBank.code }),
      });
      const d = await res.json();
      if (d.ok) {
        setBankAccount({ saved: true, account_name: d.account_name, account_number_masked: d.account_number_masked });
        setStep('cashout');
      } else {
        setErrorMsg(d.detail ?? 'Could not save account.');
      }
    } catch {
      setErrorMsg('Network error. Try again.');
    }
    setSaving(false);
  };

  const requestCashout = async () => {
    const coinCount = parseInt(coins, 10);
    if (isNaN(coinCount) || coinCount < minCoins || coinCount > balance) return;
    setCashing(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/api/coins/cashout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ coins: coinCount }),
      });
      const d = await res.json();
      if (d.ok) {
        setTransferCode(d.transfer_code);
        setNairaResult(d.naira_sent);
        setStep('success');
      } else {
        setErrorMsg(d.detail ?? 'Cashout failed. Try again.');
      }
    } catch {
      setErrorMsg('Network error. Try again.');
    }
    setCashing(false);
  };

  const coinCount = parseInt(coins, 10) || 0;
  const nairaPreview = Math.floor((coinCount / 100) * cashoutRateNaira);
  const filteredBanks = banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === 'bank_setup' ? 'Add Bank Account' :
             step === 'cashout' ? 'Cash Out Coins' :
             step === 'success' ? 'Transfer Initiated' : 'Vibe Coins'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">

          {/* ── Loading ── */}
          {step === 'loading' && (
            <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 60 }} />
          )}

          {/* ── Bank Setup ── */}
          {step === 'bank_setup' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Add your Nigerian bank account to receive cashouts.</Text>

              <Text style={styles.fieldLabel}>Account Number</Text>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={t => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="numeric"
                placeholder="0123456789"
                placeholderTextColor="#555"
                maxLength={10}
              />

              <Text style={styles.fieldLabel}>Bank</Text>
              <TextInput
                style={styles.input}
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder="Search bank..."
                placeholderTextColor="#555"
              />
              <View style={styles.bankList}>
                {filteredBanks.slice(0, 8).map(b => (
                  <TouchableOpacity
                    key={b.code}
                    style={[styles.bankItem, selectedBank?.code === b.code && styles.bankItemSelected]}
                    onPress={() => { setSelectedBank(b); setBankSearch(b.name); }}
                  >
                    <Text style={[styles.bankItemText, selectedBank?.code === b.code && styles.bankItemTextSelected]}>
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {resolving && <ActivityIndicator size="small" color="#FFD700" style={{ marginTop: 8 }} />}
              {resolvedName ? (
                <View style={styles.resolvedBox}>
                  <Text style={styles.resolvedLabel}>Account Name</Text>
                  <Text style={styles.resolvedName}>{resolvedName}</Text>
                </View>
              ) : null}

              {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, (!resolvedName || saving) && styles.primaryBtnDisabled]}
                onPress={saveAccount}
                disabled={!resolvedName || saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#0D0D1A" />
                  : <Text style={styles.primaryBtnText}>Confirm & Save Account</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Cashout ── */}
          {step === 'cashout' && (
            <View style={styles.section}>
              {bankAccount?.saved && (
                <View style={styles.accountBox}>
                  <Text style={styles.accountLabel}>Sending to</Text>
                  <Text style={styles.accountName}>{bankAccount.account_name}</Text>
                  <Text style={styles.accountMasked}>{bankAccount.account_number_masked}</Text>
                  <TouchableOpacity onPress={() => setStep('bank_setup')}>
                    <Text style={styles.changeAccount}>Change account</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.fieldLabel}>Coins to cash out</Text>
              <TextInput
                style={styles.input}
                value={coins}
                onChangeText={t => setCoins(t.replace(/\D/g, ''))}
                keyboardType="numeric"
                placeholder={String(minCoins)}
                placeholderTextColor="#555"
              />
              <Text style={styles.balanceHint}>Balance: {balance.toLocaleString()} coins</Text>

              <View style={styles.previewBox}>
                <Text style={styles.previewLabel}>You receive</Text>
                <Text style={styles.previewNaira}>₦{nairaPreview.toLocaleString()}</Text>
                <Text style={styles.previewRate}>at ₦{cashoutRateNaira}/100 coins</Text>
              </View>

              <Text style={styles.tncNote}>
                Coins earned at participating venues only. Cashback subject to available pool funds.
                Transfers typically arrive within minutes via Paystack.
              </Text>

              {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, (coinCount < minCoins || coinCount > balance || cashing) && styles.primaryBtnDisabled]}
                onPress={requestCashout}
                disabled={coinCount < minCoins || coinCount > balance || cashing}
              >
                {cashing
                  ? <ActivityIndicator size="small" color="#0D0D1A" />
                  : <Text style={styles.primaryBtnText}>Cash Out ₦{nairaPreview.toLocaleString()}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── Success ── */}
          {step === 'success' && (
            <View style={[styles.section, { alignItems: 'center', paddingTop: 32 }]}>
              <Text style={styles.successIcon}>⟡</Text>
              <Text style={styles.successTitle}>Transfer Initiated</Text>
              <Text style={styles.successAmount}>₦{nairaResult.toLocaleString()}</Text>
              <Text style={styles.successSub}>on its way to your account</Text>
              <Text style={styles.successRef}>Ref: {transferCode}</Text>
              <Text style={styles.successNote}>
                Paystack transfers typically arrive within minutes.
                Contact support if you don't receive it within 24 hours.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onSuccess}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <View style={[styles.section, { alignItems: 'center', paddingTop: 32 }]}>
              <Text style={styles.error}>{errorMsg}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={load}>
                <Text style={styles.primaryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D1A' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#1A1A2E',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 16, color: '#666' },
  body: { flex: 1 },
  section: { padding: 20 },
  sectionLabel: { fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#666', letterSpacing: 1.5, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#151520', borderRadius: 10, borderWidth: 1, borderColor: '#222',
    color: '#FFF', fontSize: 16, paddingHorizontal: 14, paddingVertical: 12,
  },
  bankList: { marginTop: 6, gap: 4 },
  bankItem: {
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: '#151520', borderWidth: 1, borderColor: '#222',
  },
  bankItemSelected: { borderColor: '#FFD700', backgroundColor: '#FFD70015' },
  bankItemText: { fontSize: 13, color: '#AAA' },
  bankItemTextSelected: { color: '#FFD700', fontWeight: '700' },
  resolvedBox: {
    marginTop: 12, backgroundColor: '#0A2A0A', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: '#1A4A1A',
  },
  resolvedLabel: { fontSize: 10, color: '#4A8A4A', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  resolvedName: { fontSize: 16, color: '#7FCC7F', fontWeight: '700' },
  accountBox: {
    backgroundColor: '#151520', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#222', marginBottom: 8,
  },
  accountLabel: { fontSize: 10, color: '#666', fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  accountName: { fontSize: 15, color: '#FFF', fontWeight: '700' },
  accountMasked: { fontSize: 12, color: '#888', marginTop: 2 },
  changeAccount: { fontSize: 11, color: '#FFD700', marginTop: 8 },
  balanceHint: { fontSize: 11, color: '#666', marginTop: 4 },
  previewBox: {
    backgroundColor: '#FFD70010', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#FFD70030', marginTop: 16, alignItems: 'center',
  },
  previewLabel: { fontSize: 11, color: '#FFD70099', fontWeight: '700', letterSpacing: 1 },
  previewNaira: { fontSize: 32, color: '#FFD700', fontWeight: '900', marginTop: 4 },
  previewRate: { fontSize: 11, color: '#FFD70066', marginTop: 2 },
  tncNote: { fontSize: 10, color: '#444', marginTop: 16, lineHeight: 16 },
  primaryBtn: {
    backgroundColor: '#FFD700', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 20,
  },
  primaryBtnDisabled: { backgroundColor: '#2A2A2A' },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: '#0D0D1A' },
  successIcon: { fontSize: 48, color: '#FFD700', marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  successAmount: { fontSize: 36, color: '#FFD700', fontWeight: '900' },
  successSub: { fontSize: 14, color: '#888', marginTop: 4 },
  successRef: { fontSize: 10, color: '#555', marginTop: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  successNote: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 20, lineHeight: 18 },
  error: { fontSize: 13, color: '#FF6B6B', marginTop: 12, textAlign: 'center' },
});
