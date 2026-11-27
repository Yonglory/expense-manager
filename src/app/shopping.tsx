import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text } from '../components/Text';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { colors, categoryColors } from '../lib/theme';
import { currentKey, fmt, parseAmount, parseKey } from '../lib/format';
import { canSync, useSyncState } from '../lib/offline';
import { BudgetLine, useShopping } from '../lib/useShopping';
import type { ShopCat, ShopItem } from '../lib/types';
import { BURMESE_REGULAR } from '../components/Text';
import { Bob, FadeIn, Pop, PressScale } from '../components/Motion';
import { Animal } from '../components/Animal';
import { Sheet, sheetTitle } from '../components/Sheet';
import { SyncBanner } from '../components/SyncBanner';
import { Bubble, Button, Field } from '../components/ui';

export default function ShoppingScreen() {
  const { household } = useAuth();
  if (!household) return null;
  return <Shopping householdId={household.id} />;
}

function useCatLabel() {
  const { t } = useI18n();
  return (c: { name: string; builtin: boolean }) =>
    c.builtin ? ({ Groceries: t.catGroceries, Household: t.catHousehold, Others: t.catOthers } as Record<string, string>)[c.name] ?? c.name : c.name;
}

function Shopping({ householdId }: { householdId: string }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const sync = useSyncState();
  const catLabel = useCatLabel();
  const { items, categories, loading, error, add, update, remove, addCategory, removeCategory, loadBudgetLines, finishShopping } =
    useShopping(householdId);
  const [text, setText] = useState('');
  const [cat, setCat] = useState('Groceries');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<ShopItem | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);

  const current = categories.find((c) => c.name === cat) ?? categories[0];
  const ticked = items.filter((i) => i.done);
  const total = items.reduce((sum, i) => sum + i.est_price, 0);

  const sections = useMemo(
    () =>
      categories
        .map((c) => ({
          cat: c,
          data: items.filter((i) => i.category === c.name).sort((a, b) => Number(a.done) - Number(b.done)),
        }))
        .filter((sec) => sec.data.length > 0),
    [categories, items],
  );

  const submit = async () => {
    const name = text.trim();
    if (!name) return;
    setText('');
    setPickerOpen(false);
    await add(name, cat);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[s.title, { flex: 1 }]}>{t.shoppingTitle}</Text>
        <Pressable onPress={() => setCatsOpen(true)} hitSlop={10} accessibilityLabel={t.categoriesTitle}>
          <Ionicons name="pricetags-outline" size={22} color={colors.text} />
        </Pressable>
      </View>
      <SyncBanner />

      <View style={s.pad}>
        <View style={s.addRow}>
          <View style={s.inputBox}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={submit}
              returnKeyType="done"
              placeholder={t.addItemPh}
              placeholderTextColor={colors.muted}
              style={[s.input, lang === 'my' && { fontFamily: BURMESE_REGULAR }]}
            />
            <Pressable onPress={() => setPickerOpen((v) => !v)} style={s.catPill}>
              <View style={[s.dot, { backgroundColor: current?.color ?? colors.blue }]} />
              <Text style={s.catPillText} numberOfLines={1}>{current ? catLabel(current) : ''}</Text>
              <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.blueText} />
            </Pressable>
          </View>
          <PressScale onPress={submit} style={s.plus} accessibilityLabel={t.addItemPh}>
            <Ionicons name="add" size={24} color="#fff" />
          </PressScale>
        </View>

        {pickerOpen && (
          <FadeIn>
            <View style={s.picker}>
              {categories.map((c) => (
                <Pressable
                  key={c.name}
                  onPress={() => {
                    setCat(c.name);
                    setPickerOpen(false);
                  }}
                  style={[s.chip, c.name === cat && s.chipOn]}
                >
                  <View style={[s.dot, { backgroundColor: c.color }]} />
                  <Text style={[s.chipText, c.name === cat && { color: colors.blueText, fontWeight: '600' }]}>{catLabel(c)}</Text>
                </Pressable>
              ))}
            </View>
          </FadeIn>
        )}

        <View style={s.sum}>
          <Text style={s.sumLeft}>{t.itemsCount(items.length)}</Text>
          {total > 0 && <Text style={s.sumRight}>{t.aboutTotal(fmt(total))}</Text>}
        </View>
      </View>

      {error && <Text style={s.notice}>{t.shoppingLoadError(error)}</Text>}

      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          loading ? undefined : (
            <View style={s.empty}>
              <Bob><Animal animal="bunny" size={76} /></Bob>
              <Text style={s.emptyText}>{t.listEmpty}</Text>
            </View>
          )
        }
        renderSectionHeader={({ section }) => {
          const sub = section.data.reduce((sum, i) => sum + i.est_price, 0);
          return (
            <View style={s.groupHead}>
              <View style={[s.dot, { backgroundColor: section.cat.color }]} />
              <Text style={s.groupTitle}>{catLabel(section.cat)}</Text>
              <Text style={s.groupSub}>{section.data.length}{sub > 0 ? ` · ${fmt(sub)}` : ''}</Text>
            </View>
          );
        }}
        renderItem={({ item, index }) => {
          const waiting = !canSync(sync) && sync.pendingIds.includes(item.id);
          return (
            <FadeIn delay={Math.min(index, 10) * 40}>
              <View style={[s.row, item.done && s.rowDone]}>
                <Pressable onPress={() => update(item.id, { done: !item.done })} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: item.done }}>
                  <Pop trigger={item.done} style={[s.cb, item.done && s.cbOn]}>
                    {item.done && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </Pop>
                </Pressable>
                <Pressable style={s.rowBody} onPress={() => setEditing(item)}>
                  <Text style={[s.name, item.done && s.done]} numberOfLines={1}>{item.name}</Text>
                  {waiting && <Ionicons name="time-outline" size={13} color={colors.sub} />}
                  {item.est_price > 0 && <Text style={[s.price, item.done && s.done]}>{fmt(item.est_price)}</Text>}
                </Pressable>
              </View>
            </FadeIn>
          );
        }}
      />

      {ticked.length > 0 && (
        <FadeIn style={s.footer}>
          <Button label={t.doneShoppingN(ticked.length)} tone="green" onPress={() => setDoneOpen(true)} style={{ backgroundColor: colors.green }} />
        </FadeIn>
      )}

      <EditSheet
        item={editing}
        categories={categories}
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
        count={ticked.length}
        suggested={ticked.reduce((sum, i) => sum + i.est_price, 0)}
        loadLines={loadBudgetLines}
        onClose={() => setDoneOpen(false)}
        onConfirm={async (spent, line) => {
          await finishShopping(spent, line, catLabel({ name: 'Groceries', builtin: true }));
          setDoneOpen(false);
        }}
      />
      <CategorySheet
        visible={catsOpen}
        categories={categories}
        onClose={() => setCatsOpen(false)}
        onAdd={addCategory}
        onRemove={async (c) => {
          if (cat === c.name) setCat('Groceries');
          await removeCategory(c);
        }}
      />
    </SafeAreaView>
  );
}

function CatChips({ categories, value, onPick }: { categories: ShopCat[]; value: string; onPick: (n: string) => void }) {
  const catLabel = useCatLabel();
  return (
    <View style={s.picker}>
      {categories.map((c) => (
        <Pressable key={c.name} onPress={() => onPick(c.name)} style={[s.chip, c.name === value && s.chipOn]}>
          <View style={[s.dot, { backgroundColor: c.color }]} />
          <Text style={[s.chipText, c.name === value && { color: colors.blueText, fontWeight: '600' }]}>{catLabel(c)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EditSheet({
  item, categories, onClose, onSave, onDelete,
}: {
  item: ShopItem | null; categories: ShopCat[]; onClose: () => void;
  onSave: (id: string, patch: { name: string; category: string; est_price: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cat, setCat] = useState('Groceries');
  React.useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(item.est_price > 0 ? String(item.est_price) : '');
      setCat(item.category);
    }
  }, [item]);
  return (
    <Sheet visible={!!item} onClose={onClose}>
      <Text style={sheetTitle}>{t.editItem}</Text>
      <Field placeholder={t.namePh} value={name} onChangeText={setName} />
      <Field placeholder={t.estPricePh} value={price} onChangeText={setPrice} keyboardType="numeric" />
      <CatChips categories={categories} value={cat} onPick={setCat} />
      <Button label={t.save} onPress={() => item && name.trim() && onSave(item.id, { name: name.trim(), category: cat, est_price: parseAmount(price) })} />
      <Button label={t.deleteItem} tone="danger" onPress={() => item && onDelete(item.id)} />
      <Button label={t.cancel} tone="soft" onPress={onClose} />
    </Sheet>
  );
}

function DoneSheet({
  visible, count, suggested, loadLines, onClose, onConfirm,
}: {
  visible: boolean; count: number; suggested: number; loadLines: () => Promise<BudgetLine[]>;
  onClose: () => void; onConfirm: (spent: number, line: BudgetLine | null) => Promise<void>;
}) {
  const { t } = useI18n();
  const catLabel = useCatLabel();
  const [amount, setAmount] = useState('');
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [pick, setPick] = useState<string>('new');
  const [busy, setBusy] = useState(false);
  const monthName = t.monthNames[parseKey(currentKey()).month0];

  React.useEffect(() => {
    if (!visible) return;
    setAmount(suggested > 0 ? String(suggested) : '');
    setBusy(false);
    loadLines().then((ls) => {
      setLines(ls);
      const g = ls.find((l) => /grocer|စားသောက်/i.test(l.name));
      setPick(g ? g.id : 'new');
    });
  }, [visible, suggested, loadLines]);

  const line = lines.find((l) => l.id === pick) ?? null;
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>{t.doneShopping}</Text>
      <Text style={s.help}>{t.doneHelp(count, fmt(suggested))}</Text>
      <Field placeholder={t.amountSpentPh} value={amount} onChangeText={setAmount} keyboardType="numeric" autoFocus />
      <Text style={s.help}>{t.addedTo(monthName)}</Text>
      <View style={s.picker}>
        {lines.map((l) => (
          <Pressable key={l.id} onPress={() => setPick(l.id)} style={[s.chip, pick === l.id && s.chipOn]}>
            <Text style={[s.chipText, pick === l.id && { color: colors.blueText, fontWeight: '600' }]}>{l.name}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setPick('new')} style={[s.chip, pick === 'new' && s.chipOn]}>
          <Ionicons name="add" size={14} color={pick === 'new' ? colors.blueText : colors.sub} />
          <Text style={[s.chipText, pick === 'new' && { color: colors.blueText, fontWeight: '600' }]}>
            {t.newLine(catLabel({ name: 'Groceries', builtin: true }))}
          </Text>
        </Pressable>
      </View>
      <Button
        label={t.saveAndClear}
        busy={busy}
        onPress={async () => {
          setBusy(true);
          await onConfirm(parseAmount(amount), line);
          setBusy(false);
        }}
      />
      <Button label={t.cancel} tone="soft" onPress={onClose} />
    </Sheet>
  );
}

function CategorySheet({
  visible, categories, onClose, onAdd, onRemove,
}: {
  visible: boolean; categories: ShopCat[]; onClose: () => void;
  onAdd: (name: string, color: string) => Promise<void>; onRemove: (c: ShopCat) => Promise<void>;
}) {
  const { t } = useI18n();
  const catLabel = useCatLabel();
  const [name, setName] = useState('');
  const [color, setColor] = useState(categoryColors[1]);
  React.useEffect(() => {
    if (visible) setName('');
  }, [visible]);
  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={sheetTitle}>{t.categoriesTitle}</Text>
      {categories.map((c) => (
        <View key={c.name} style={s.catRow}>
          <View style={[s.dot, { backgroundColor: c.color }]} />
          <Text style={{ flex: 1, color: colors.text }}>{catLabel(c)}</Text>
          {c.builtin ? (
            <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
          ) : (
            <Pressable onPress={() => onRemove(c)} hitSlop={10} accessibilityLabel={t.deleteItem}>
              <Ionicons name="trash-outline" size={18} color={colors.pinkText} />
            </Pressable>
          )}
        </View>
      ))}
      <Text style={s.help}>{t.removeNote}</Text>
      <Text style={s.label}>{t.suggested}</Text>
      <View style={s.picker}>
        {t.suggestionNames.map((n) => (
          <Pressable key={n} onPress={() => setName(n)} style={s.chip}>
            <Text style={s.chipText}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <Field placeholder={t.newCategoryName} value={name} onChangeText={setName} />
      <View style={s.colorRow}>
        {categoryColors.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)} style={[s.color, { backgroundColor: c }, color === c && s.colorOn]} />
        ))}
      </View>
      <Button
        label={t.addCategory}
        onPress={async () => {
          if (!name.trim()) return;
          await onAdd(name, color);
          setName('');
        }}
      />
      <Button label={t.done} tone="soft" onPress={onClose} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  pad: { paddingHorizontal: 16, gap: 8 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 6,
    borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff',
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 15, color: colors.text },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.blueSoft, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, maxWidth: 120 },
  catPillText: { fontSize: 12, color: colors.blueText },
  plus: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 11, borderRadius: 14, backgroundColor: colors.row },
  chipOn: { backgroundColor: colors.blueSoft },
  chipText: { fontSize: 13, color: colors.sub },
  dot: { width: 9, height: 9, borderRadius: 5 },
  sum: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  sumLeft: { color: colors.sub, fontSize: 13 },
  sumRight: { fontSize: 16, fontWeight: '700', color: colors.text },
  notice: { marginHorizontal: 16, marginTop: 6, backgroundColor: colors.peach, color: colors.peachText, padding: 10, borderRadius: 12, fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 110, flexGrow: 1 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 36 },
  emptyText: { color: colors.sub, textAlign: 'center' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 12, paddingBottom: 6 },
  groupTitle: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1 },
  groupSub: { fontSize: 12, color: colors.sub },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.row, marginBottom: 6 },
  rowDone: { backgroundColor: colors.greenSoft },
  cb: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#B9C8D8', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  cbOn: { backgroundColor: colors.green, borderColor: colors.green },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  price: { fontSize: 14, color: colors.sub },
  done: { textDecorationLine: 'line-through', color: colors.muted },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  help: { color: colors.sub, fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 14, backgroundColor: colors.row },
  colorRow: { flexDirection: 'row', gap: 10 },
  color: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#fff' },
  colorOn: { borderColor: colors.text },
});
