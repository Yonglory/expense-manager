import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors } from '../lib/theme';
import { MONTH_NAMES, currentKey, fmt, parseAmount, parseKey } from '../lib/format';
import { BudgetLine, useShopping } from '../lib/useShopping';
import type { ShopCategory, ShopItem } from '../lib/types';
import { Animal } from '../components/Animal';
import { Bob, FadeIn, Pop, PressScale } from '../components/Motion';
import { Sheet, sheetTitle } from '../components/Sheet';
import { Bubble, Button, Field } from '../components/ui';

const CATEGORIES: { id: ShopCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'Groceries', icon: 'basket-outline' },
  { id: 'Household', icon: 'home-outline' },
  { id: 'Baby', icon: 'happy-outline' },
  { id: 'Other', icon: 'ellipsis-horizontal' },
];

export default function ShoppingScreen() {
  const { household } = useAuth();
  if (!household) return null;
  return <Shopping householdId={household.id} />;
}

function Shopping({ householdId }: { householdId: string }) {
  const router = useRouter();
  const { items, loading, error, add, update, remove, clearTicked, loadBudgetLines, finishShopping, buyAgain } = useShopping(householdId);
  const [text, setText] = useState('');
  const [cat, setCat] = useState<ShopCategory>('Groceries');
  const [editing, setEditing] = useState<ShopItem | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const toBuy = items.filter((i) => !i.done);
  const ticked = items.filter((i) => i.done);
  const estTotal = toBuy.reduce((sum, i) => sum + i.est_price, 0);
  const tickedTotal = ticked.reduce((sum, i) => sum + i.est_price, 0);

  const sections = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        title: c.id,
        icon: c.icon,
        data: items.filter((i) => i.category === c.id).sort((a, b) => Number(a.done) - Number(b.done)),
      })).filter((sec) => sec.data.length > 0),
    [items],
  );

  const submit = async () => {
    const name = text.trim();
    if (!name) return;
    setText('');
    const err = await add(name, cat);
    if (err) setNotice(err);
  };

  const message =
    items.length === 0
      ? 'Nothing on the list yet. Add what you need to buy.'
      : toBuy.length === 0
        ? 'All ticked! Tap Done shopping to record what you spent.'
        : `${toBuy.length} to buy${estTotal > 0 ? `, about ${fmt(estTotal)}` : ''}.`;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Shopping list</Text>
      </View>

      <View style={s.pad}>
        <View style={s.summary}>
          <Bob><Animal animal="bunny" size={44} /></Bob>
          <Bubble text={message} />
        </View>

        <View style={s.addRow}>
          <View style={{ flex: 1 }}>
            <Field placeholder="Add an item, for example Rice" value={text} onChangeText={setText} onSubmitEditing={submit} returnKeyType="done" />
          </View>
          <PressScale onPress={submit} style={s.addBtn} accessibilityLabel="Add to list">
            <Ionicons name="add" size={24} color="#fff" />
          </PressScale>
        </View>
        <View style={s.catRow}>
          {CATEGORIES.map((c) => (
            <Pressable key={c.id} onPress={() => setCat(c.id)} style={[s.catChip, cat === c.id && s.catOn]}>
              <Ionicons name={c.icon} size={14} color={cat === c.id ? colors.blueText : colors.sub} />
              <Text style={[s.catText, cat === c.id && { color: colors.blueText, fontWeight: '600' }]}>{c.id}</Text>
            </Pressable>
          ))}
        </View>

        {buyAgain.length > 0 && (
          <View>
            <Text style={s.label}>Buy again</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {buyAgain.map((b) => (
                <PressScale key={b.name} onPress={() => add(b.name, b.category, b.est_price)} style={s.again}>
                  <Ionicons name="refresh" size={12} color={colors.greenText} />
                  <Text style={s.againText}>{b.name}</Text>
                </PressScale>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {(error || notice) && <Text style={s.notice}>{error ? `Couldn't load the list. ${error}` : notice}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.list}
        ListEmptyComponent={loading ? undefined : <Text style={s.empty}>Your list is empty.</Text>}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHead}>
            <Ionicons name={section.icon} size={14} color={colors.sub} />
            <Text style={s.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index, 10) * 40}>
            <View style={[s.row, item.done && s.rowDone]}>
              <Pressable onPress={() => update(item.id, { done: !item.done })} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: item.done }}>
                <Pop trigger={item.done} style={[s.cb, item.done && s.cbOn]}>
                  {item.done && <Ionicons name="checkmark" size={14} color="#fff" />}
                </Pop>
              </Pressable>
              <Pressable style={s.rowBody} onPress={() => setEditing(item)}>
                <Text style={[s.name, item.done && s.done]} numberOfLines={1}>{item.name}</Text>
                {item.est_price > 0 && <Text style={[s.price, item.done && s.done]}>{fmt(item.est_price)}</Text>}
              </Pressable>
            </View>
          </FadeIn>
        )}
      />

      {ticked.length > 0 && (
        <FadeIn style={s.footer}>
          <Button label={`Done shopping (${ticked.length})`} onPress={() => setDoneOpen(true)} />
          <Button label="Clear ticked" tone="soft" onPress={clearTicked} />
        </FadeIn>
      )}

      <EditSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSave={async (id, patch) => {
          await update(id, patch);
          setEditing(null);
        }}
        onDelete={async (id) => {
          await remove(id);
          setEditing(null);
        }}
      />

      <DoneSheet
        visible={doneOpen}
        suggested={tickedTotal}
        loadLines={loadBudgetLines}
        onClose={() => setDoneOpen(false)}
        onConfirm={async (spent, line, newName) => {
          const err = await finishShopping(spent, line, newName);
          setNotice(err);
          setDoneOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function EditSheet({
  item, onClose, onSave, onDelete,
}: {
  item: ShopItem | null;
  onClose: () => void;
  onSave: (id: string, patch: { name: string; category: ShopCategory; est_price: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cat, setCat] = useState<ShopCategory>('Groceries');
  React.useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(item.est_price > 0 ? String(item.est_price) : '');
      setCat(item.category);
    }
  }, [item]);
  return (
    <Sheet visible={!!item} onClose={onClose}>
      <Text style={sheetTitle}>Edit item</Text>
      <Field placeholder="Name" value={name} onChangeText={setName} />
      <Field placeholder="Estimated price (optional)" value={price} onChangeText={setPrice} keyboardType="numeric" />
      <View style={s.catRow}>
        {CATEGORIES.map((c) => (
          <Pressable key={c.id} onPress={() => setCat(c.id)} style={[s.catChip, cat === c.id && s.catOn]}>
            <Ionicons name={c.icon} size={14} color={cat === c.id ? colors.blueText : colors.sub} />
            <Text style={[s.catText, cat === c.id && { color: colors.blueText, fontWeight: '600' }]}>{c.id}</Text>
          </Pressable>
        ))}
      </View>
      <Button label="Save" onPress={() => item && name.trim() && onSave(item.id, { name: name.trim(), category: cat, est_price: parseAmount(price) })} />
      <Button label="Delete item" tone="danger" onPress={() => item && onDelete(item.id)} />
      <Button label="Cancel" tone="soft" onPress={onClose} />
    </Sheet>
  );
}

function DoneSheet({
  visible, suggested, loadLines, onClose, onConfirm,
}: {
  visible: boolean;
  suggested: number;
  loadLines: () => Promise<BudgetLine[]>;
  onClose: () => void;
  onConfirm: (spent: number, line: BudgetLine | null, newName: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [pick, setPick] = useState<string>('new');
  const [busy, setBusy] = useState(false);
  const monthName = MONTH_NAMES[parseKey(currentKey()).month0];

  React.useEffect(() => {
    if (!visible) return;
    setAmount(suggested > 0 ? String(suggested) : '');
    setBusy(false);
    loadLines().then((ls) => {
      setLines(ls);
      const g = ls.find((l) => /grocer/i.test(l.name));
      setPick(g ? g.id : 'new');
    });
  }, [visible, suggested, loadLines]);

  const line = lines.find((l) => l.id === pick) ?? null;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>Done shopping</Text>
      <Text style={s.help}>How much did you spend? It's added to your {monthName} budget as "actual spent".</Text>
      <Field placeholder="Amount spent" value={amount} onChangeText={setAmount} keyboardType="numeric" autoFocus />
      <Text style={s.label}>Add it to</Text>
      <View style={s.catRow}>
        {lines.map((l) => (
          <Pressable key={l.id} onPress={() => setPick(l.id)} style={[s.catChip, pick === l.id && s.catOn]}>
            <Text style={[s.catText, pick === l.id && { color: colors.blueText, fontWeight: '600' }]}>{l.name}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setPick('new')} style={[s.catChip, pick === 'new' && s.catOn]}>
          <Ionicons name="add" size={14} color={pick === 'new' ? colors.blueText : colors.sub} />
          <Text style={[s.catText, pick === 'new' && { color: colors.blueText, fontWeight: '600' }]}>New line: Groceries</Text>
        </Pressable>
      </View>
      <Button
        label="Save and clear ticked items"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          await onConfirm(parseAmount(amount), line, 'Groceries');
          setBusy(false);
        }}
      />
      <Button label="Cancel" tone="soft" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 6 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  pad: { paddingHorizontal: 16, gap: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.blueTint, borderRadius: 18, padding: 10, borderWidth: 1, borderColor: colors.line },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.row },
  catOn: { backgroundColor: colors.blueSoft },
  catText: { fontSize: 13, color: colors.sub },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  again: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.greenSoft, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10 },
  againText: { fontSize: 13, color: colors.greenText },
  notice: { marginHorizontal: 16, marginTop: 6, backgroundColor: colors.peach, color: colors.peachText, padding: 10, borderRadius: 12, fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 140, flexGrow: 1 },
  empty: { color: colors.sub, textAlign: 'center', paddingTop: 30 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.sub },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.row, marginBottom: 6 },
  rowDone: { backgroundColor: colors.greenSoft },
  cb: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#B9C8D8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cbOn: { backgroundColor: colors.green, borderColor: colors.green },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  price: { fontSize: 14, color: colors.sub },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 8, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  help: { color: colors.sub, fontSize: 13 },
});
